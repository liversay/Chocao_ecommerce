import "./mocks/clerk";
import "./mocks/stripe";
import { beforeAll, describe, expect, test } from "bun:test";
import { createHash, randomBytes } from "node:crypto";
import { createApp } from "../app";
import { __resetSecretForTests } from "../oauth/tokens";
import { setupTestDB } from "./db";
import { authHeader, createUser } from "./factories";
import type { UserDoc } from "../models/User";

setupTestDB();
const app = createApp();

beforeAll(() => {
  process.env.OAUTH_JWT_SECRET = "secreto-de-test-para-oauth";
  __resetSecretForTests();
});

const REDIRECT = "http://localhost:41234/callback";

async function registerClient(): Promise<string> {
  const res = await app.request("/oauth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ redirect_uris: [REDIRECT], client_name: "Claude Code (test)" }),
  });
  expect(res.status).toBe(201);
  return ((await res.json()) as { client_id: string }).client_id;
}

function pkcePair() {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

async function authorizeAndGetCode(user: UserDoc, clientId: string, challenge: string, scope?: string) {
  const res = await app.request("/oauth/authorize/approve", {
    method: "POST",
    headers: authHeader(user),
    body: JSON.stringify({
      client_id: clientId,
      redirect_uri: REDIRECT,
      scope,
      state: "estado-xyz",
      code_challenge: challenge,
    }),
  });
  expect(res.status).toBe(200);
  const { redirect } = (await res.json()) as { redirect: string };
  const url = new URL(redirect);
  expect(url.searchParams.get("state")).toBe("estado-xyz");
  return url.searchParams.get("code")!;
}

async function exchangeCode(clientId: string, code: string, verifier: string) {
  return app.request("/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      client_id: clientId,
      redirect_uri: REDIRECT,
    }),
  });
}

describe("OAuth 2.1 + PKCE (HU-45)", () => {
  test("publica la metadata de descubrimiento (RFC 8414 y 9728)", async () => {
    const as = (await (await app.request("/.well-known/oauth-authorization-server")).json()) as Record<string, unknown>;
    expect(as.authorization_endpoint).toContain("/oauth/authorize");
    expect(as.code_challenge_methods_supported).toEqual(["S256"]);
    expect(as.registration_endpoint).toContain("/oauth/register");

    const rs = (await (await app.request("/.well-known/oauth-protected-resource")).json()) as Record<string, unknown>;
    expect(String(rs.resource)).toContain("/mcp");
  });

  test("flujo completo: register → authorize → token → acceso a /mcp", async () => {
    const user = await createUser();
    const clientId = await registerClient();
    const { verifier, challenge } = pkcePair();
    const code = await authorizeAndGetCode(user, clientId, challenge, "catalog:read bids:read");

    const tokenRes = await exchangeCode(clientId, code, verifier);
    expect(tokenRes.status).toBe(200);
    const tokens = (await tokenRes.json()) as { access_token: string; refresh_token: string; scope: string };
    expect(tokens.scope).toBe("catalog:read bids:read");

    // El token abre el handshake MCP (initialize por Streamable HTTP)
    const init = await app.request("/mcp", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "test-client", version: "0.0.1" },
        },
      }),
    });
    expect(init.status).toBe(200);
    const text = await init.text();
    expect(text).toContain('"serverInfo"');
    expect(text).toContain("chocao");
  });

  test("los scopes se intersectan con el rol: un customer no recibe scopes admin", async () => {
    const user = await createUser(); // customer
    const clientId = await registerClient();
    const { verifier, challenge } = pkcePair();
    const code = await authorizeAndGetCode(user, clientId, challenge, "catalog:read vehicle:write audit:read");

    const tokens = (await (await exchangeCode(clientId, code, verifier)).json()) as { scope: string };
    expect(tokens.scope).toBe("catalog:read");
  });

  test("un code_verifier incorrecto falla la verificación PKCE", async () => {
    const user = await createUser();
    const clientId = await registerClient();
    const { challenge } = pkcePair();
    const code = await authorizeAndGetCode(user, clientId, challenge);

    const res = await exchangeCode(clientId, code, "verificador-equivocado-".repeat(3));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("invalid_grant");
  });

  test("un código es de un solo uso", async () => {
    const user = await createUser();
    const clientId = await registerClient();
    const { verifier, challenge } = pkcePair();
    const code = await authorizeAndGetCode(user, clientId, challenge);

    expect((await exchangeCode(clientId, code, verifier)).status).toBe(200);
    expect((await exchangeCode(clientId, code, verifier)).status).toBe(400);
  });

  test("el refresh token rota: el anterior queda revocado", async () => {
    const user = await createUser();
    const clientId = await registerClient();
    const { verifier, challenge } = pkcePair();
    const code = await authorizeAndGetCode(user, clientId, challenge);
    const tokens = (await (await exchangeCode(clientId, code, verifier)).json()) as { refresh_token: string };

    const refresh = (body: Record<string, string>) =>
      app.request("/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "refresh_token", client_id: clientId, ...body }),
      });

    const first = await refresh({ refresh_token: tokens.refresh_token });
    expect(first.status).toBe(200);
    const rotated = (await first.json()) as { refresh_token: string };
    expect(rotated.refresh_token).not.toBe(tokens.refresh_token);

    // El refresh viejo ya no sirve
    expect((await refresh({ refresh_token: tokens.refresh_token })).status).toBe(400);
    // El nuevo sí
    expect((await refresh({ refresh_token: rotated.refresh_token })).status).toBe(200);
  });

  test("/mcp sin token responde 401 con WWW-Authenticate hacia la metadata", async () => {
    const res = await app.request("/mcp", { method: "POST" });
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain("oauth-protected-resource");
  });

  test("una redirect_uri no registrada se rechaza", async () => {
    const user = await createUser();
    const clientId = await registerClient();
    const { challenge } = pkcePair();

    const res = await app.request("/oauth/authorize/approve", {
      method: "POST",
      headers: authHeader(user),
      body: JSON.stringify({
        client_id: clientId,
        redirect_uri: "https://atacante.example.net/callback",
        code_challenge: challenge,
      }),
    });
    expect(res.status).toBe(400);
  });
});
