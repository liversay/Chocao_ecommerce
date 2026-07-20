import { Hono } from "hono";
import { z } from "zod";
import { createHash, randomBytes } from "node:crypto";
import { NotFoundError, UnauthorizedError, ValidationError } from "../lib/errors";
import { PERMISSIONS, permissionsForRole, type Permission } from "../lib/permissions";
import { validate } from "../schemas/common";
import { requirePermission, verifyClerkToken } from "../middlewares/auth";
import { recordAudit } from "../services/audit";
import { User } from "../models/User";
import { OAuthClient, OAuthCode, RefreshToken } from "./models";
import { issuer, signAccessToken } from "./tokens";
import type { AppEnv } from "../types";

// Authorization Server OAuth 2.1 mínimo, embebido en el backend. La
// identidad la da Clerk (el consentimiento exige una sesión Clerk válida);
// este AS emite JWTs propios con scopes de grano fino mapeados al RBAC.
const oauth = new Hono<AppEnv>();

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutos
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

// ---------- Metadata de descubrimiento ----------

// RFC 8414 — Authorization Server Metadata
oauth.get("/.well-known/oauth-authorization-server", (c) =>
  c.json({
    issuer: issuer(),
    authorization_endpoint: `${issuer()}/oauth/authorize`,
    token_endpoint: `${issuer()}/oauth/token`,
    registration_endpoint: `${issuer()}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [...PERMISSIONS],
  })
);

// RFC 9728 — Protected Resource Metadata (la publica el Resource Server /mcp)
oauth.get("/.well-known/oauth-protected-resource", (c) =>
  c.json({
    resource: `${issuer()}/mcp`,
    authorization_servers: [issuer()],
    scopes_supported: [...PERMISSIONS],
    bearer_methods_supported: ["header"],
  })
);

// ---------- Dynamic Client Registration (RFC 7591) ----------
// Claude Code registra su cliente automáticamente la primera vez.

const registerSchema = z.object({
  redirect_uris: z.array(z.string().url("redirect_uri inválida").max(2048)).min(1),
  client_name: z.string().max(120).optional(),
  token_endpoint_auth_method: z.string().optional(),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
  scope: z.string().max(1000).optional(),
});

oauth.post("/oauth/register", validate("json", registerSchema), async (c) => {
  const body = c.req.valid("json");
  const client = await OAuthClient.create({
    clientId: `chocao_${randomBytes(16).toString("hex")}`,
    clientName: body.client_name,
    redirectUris: body.redirect_uris,
  });

  return c.json(
    {
      client_id: client.clientId,
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
    201
  );
});

// ---------- Authorization endpoint (PKCE S256 obligatorio) ----------

const authorizeQuerySchema = z.object({
  response_type: z.literal("code", "Solo se soporta response_type=code"),
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  scope: z.string().max(1000).optional(),
  state: z.string().max(1000).optional(),
  code_challenge: z.string().min(43).max(128),
  code_challenge_method: z.literal("S256", "PKCE S256 es obligatorio"),
});

// Redirige a la página de consentimiento del frontend (usuario con sesión
// Clerk). El frontend llama luego a /oauth/authorize/approve.
oauth.get("/oauth/authorize", validate("query", authorizeQuerySchema), async (c) => {
  const q = c.req.valid("query");

  const client = await OAuthClient.findOne({ clientId: q.client_id, revoked: false });
  if (!client) throw new ValidationError("client_id desconocido o revocado");
  if (!client.redirectUris.includes(q.redirect_uri)) {
    throw new ValidationError("redirect_uri no registrada para este cliente");
  }

  const frontend = process.env.FRONTEND_URL || "http://localhost:5173";
  const consent = new URL(`${frontend}/mcp-consent`);
  for (const [key, value] of Object.entries(q)) {
    if (value) consent.searchParams.set(key, String(value));
  }
  return c.redirect(consent.toString(), 302);
});

const approveSchema = z.object({
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  scope: z.string().max(1000).optional(),
  state: z.string().max(1000).optional(),
  code_challenge: z.string().min(43).max(128),
});

// El frontend (sesión Clerk) aprueba el consentimiento y recibe la URL de
// redirección con el código. Los scopes se intersectan con los permisos del
// rol: nadie consiente más de lo que su rol permite.
oauth.post("/oauth/authorize/approve", validate("json", approveSchema), async (c) => {
  const payload = await verifyClerkToken(c);
  if (!payload) throw new UnauthorizedError("Se requiere una sesión activa para autorizar");
  const user = await User.findOne({ clerkId: payload.sub });
  if (!user) throw new UnauthorizedError("Usuario no sincronizado");

  const body = c.req.valid("json");
  const client = await OAuthClient.findOne({ clientId: body.client_id, revoked: false });
  if (!client) throw new ValidationError("client_id desconocido o revocado");
  if (!client.redirectUris.includes(body.redirect_uri)) {
    throw new ValidationError("redirect_uri no registrada para este cliente");
  }

  const rolePermissions = permissionsForRole(user.role);
  const requested = (body.scope?.split(/\s+/).filter(Boolean) ?? [...rolePermissions]) as Permission[];
  const granted = requested.filter((s) => rolePermissions.includes(s));
  if (granted.length === 0) {
    throw new ValidationError("Ninguno de los scopes solicitados está permitido para tu rol");
  }

  const code = randomBytes(32).toString("base64url");
  await OAuthCode.create({
    code,
    clientId: client.clientId,
    userId: user._id,
    scope: granted.join(" "),
    redirectUri: body.redirect_uri,
    codeChallenge: body.code_challenge,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  const redirect = new URL(body.redirect_uri);
  redirect.searchParams.set("code", code);
  if (body.state) redirect.searchParams.set("state", body.state);
  return c.json({ redirect: redirect.toString(), grantedScopes: granted });
});

// ---------- Token endpoint ----------

function s256(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

async function issueTokens(userId: string, clientId: string, scope: string) {
  const { token, expiresIn } = await signAccessToken({
    sub: userId,
    scope,
    client_id: clientId,
  });
  const refresh = randomBytes(32).toString("base64url");
  await RefreshToken.create({
    token: refresh,
    clientId,
    userId,
    scope,
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });
  return {
    access_token: token,
    token_type: "Bearer",
    expires_in: expiresIn,
    refresh_token: refresh,
    scope,
  };
}

// Acepta application/x-www-form-urlencoded (estándar OAuth) y JSON.
oauth.post("/oauth/token", async (c) => {
  const contentType = c.req.header("content-type") ?? "";
  const body: Record<string, string> = contentType.includes("json")
    ? ((await c.req.json()) as Record<string, string>)
    : Object.fromEntries((await c.req.formData()).entries()) as Record<string, string>;

  const grantType = body.grant_type;

  if (grantType === "authorization_code") {
    const { code, code_verifier, client_id, redirect_uri } = body;
    if (!code || !code_verifier || !client_id) {
      return c.json({ error: "invalid_request", error_description: "Faltan parámetros" }, 400);
    }

    // De un solo uso: se elimina atómicamente al canjearlo
    const stored = await OAuthCode.findOneAndDelete({ code, clientId: client_id });
    if (!stored || stored.expiresAt < new Date()) {
      return c.json({ error: "invalid_grant", error_description: "Código inválido o expirado" }, 400);
    }
    if (redirect_uri && stored.redirectUri !== redirect_uri) {
      return c.json({ error: "invalid_grant", error_description: "redirect_uri no coincide" }, 400);
    }
    if (s256(code_verifier) !== stored.codeChallenge) {
      return c.json({ error: "invalid_grant", error_description: "Verificación PKCE fallida" }, 400);
    }

    return c.json(await issueTokens(stored.userId.toString(), client_id, stored.scope));
  }

  if (grantType === "refresh_token") {
    const { refresh_token, client_id } = body;
    if (!refresh_token || !client_id) {
      return c.json({ error: "invalid_request", error_description: "Faltan parámetros" }, 400);
    }

    // Rotación: el refresh usado se revoca atómicamente y se emite uno nuevo
    const stored = await RefreshToken.findOneAndUpdate(
      { token: refresh_token, clientId: client_id, revoked: false, expiresAt: { $gt: new Date() } },
      { revoked: true }
    );
    if (!stored) {
      return c.json({ error: "invalid_grant", error_description: "Refresh token inválido" }, 400);
    }

    return c.json(await issueTokens(stored.userId.toString(), client_id, stored.scope));
  }

  return c.json({ error: "unsupported_grant_type" }, 400);
});

// ---------- Revocación de clientes (HU-60) ----------
// Un admin revoca un cliente MCP comprometido: sus refresh tokens se
// invalidan de inmediato y mcpAuth (mcp/index.ts) rechaza sus access tokens
// vigentes en la próxima llamada — sin afectar a los demás clientes.
oauth.post(
  "/oauth/clients/:clientId/revoke",
  requirePermission("mcp:manage"),
  async (c) => {
    const clientId = c.req.param("clientId");
    const client = await OAuthClient.findOneAndUpdate(
      { clientId },
      { revoked: true },
      { returnDocument: "after" }
    );
    if (!client) throw new NotFoundError("Cliente MCP no encontrado");

    await RefreshToken.updateMany({ clientId, revoked: false }, { revoked: true });

    await recordAudit({
      actor: c.get("user"),
      action: "mcp.client.revoke",
      resource: "oauth_client",
      resourceId: clientId,
      before: { revoked: false },
      after: { revoked: true },
      requestId: c.get("requestId"),
    });

    return c.json({ revoked: true, clientId });
  }
);

export default oauth;
