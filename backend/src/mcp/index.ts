import { Hono } from "hono";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { attachToolHandlers } from "./registry";
import { StreamableHTTPTransport } from "@hono/mcp";
import type { Context, Next } from "hono";
import { verifyAccessToken } from "../oauth/tokens";
import { issuer } from "../oauth/tokens";
import { User } from "../models/User";
import type { AppEnv, McpAuthInfo } from "../types";
import type { Permission } from "../lib/permissions";
import { permissionsForRole } from "../lib/permissions";

// Autenticación del Resource Server MCP: exige un access token del AS de
// Chocao. Sin token (o inválido) → 401 con WWW-Authenticate apuntando a la
// Protected Resource Metadata (RFC 9728), que es como los clientes MCP
// descubren el flujo OAuth.
export async function mcpAuth(c: Context<AppEnv>, next: Next) {
  const header = c.req.header("Authorization");
  const unauthorized = () => {
    c.header(
      "WWW-Authenticate",
      `Bearer resource_metadata="${issuer()}/.well-known/oauth-protected-resource"`
    );
    return c.json({ error: "No autorizado: se requiere un access token MCP" }, 401);
  };

  if (!header?.startsWith("Bearer ")) return unauthorized();

  const claims = await verifyAccessToken(header.slice(7));
  if (!claims) return unauthorized();

  const user = await User.findById(claims.sub);
  if (!user) return unauthorized();

  // Scope efectivo = scopes del token ∩ permisos actuales del rol. Si el rol
  // bajó desde que se emitió el token, los scopes extra dejan de servir.
  const rolePermissions = permissionsForRole(user.role);
  const scopes = claims.scope
    .split(/\s+/)
    .filter((s): s is Permission => (rolePermissions as readonly string[]).includes(s));

  const auth: McpAuthInfo = { user, scopes, jti: claims.jti, clientId: claims.client_id };
  c.set("mcpAuth", auth);
  await next();
}

// Construye el servidor MCP para una sesión autenticada. Las tools/resources
// se registran en los PRs de HU-47…HU-58 vía el registry (HU-59).
export function buildMcpServer(auth: McpAuthInfo): McpServer {
  const server = new McpServer(
    { name: "chocao", version: "1.0.0" },
    { instructions: "Servidor MCP de Chocao — subastas de vehículos del gobierno de Panamá." }
  );
  // Discovery (HU-46): tools/resources/prompts listables desde el handshake.
  // Las tools de negocio se registran vía el registry (HU-47…HU-58) y el
  // listado se filtra por los scopes del token (HU-59).
  server.server.registerCapabilities({
    tools: { listChanged: true },
    resources: { listChanged: true },
    prompts: { listChanged: true },
  });
  // tools/list y tools/call con gating por scope∩rol (registry, HU-59)
  attachToolHandlers(server.server, auth);
  server.server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [] }));
  server.server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: [] }));
  return server;
}

const mcp = new Hono<AppEnv>();

// Transporte Streamable HTTP en modo stateless: cada request construye el
// servidor con la identidad/scopes del token. (Las sesiones stateful con
// suscripciones llegan con el resource catalog://vehicles, HU-58.)
mcp.all("/", mcpAuth, async (c) => {
  const server = buildMcpServer(c.get("mcpAuth")!);
  const transport = new StreamableHTTPTransport();
  await server.connect(transport);
  return transport.handleRequest(c);
});

export default mcp;
