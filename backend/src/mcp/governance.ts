// Middleware de gobernanza MCP aplicado a TODAS las tools (HU-60):
// rate limiting por token/usuario y auditoría inmutable de cada invocación.
// Importar este módulo por su efecto secundario (registra los hooks) antes
// de servir /mcp.
import { AppError } from "../lib/errors";
import { hitRateLimit } from "../middlewares/rateLimit";
import { recordAudit } from "../services/audit";
import { onToolInvocation, onToolResult } from "./registry";

// Leído en cada invocación (no cacheado) para que sea configurable en
// caliente y testeable sin reiniciar el proceso.
function rateLimitMax(): number {
  return Number(process.env.MCP_RATE_LIMIT_MAX ?? 60);
}
const MCP_RATE_LIMIT_WINDOW_MS = 60_000;

// Nunca se registran valores de argumentos que parezcan credenciales.
const SENSITIVE_KEY = /token|secret|password|clave|card|tarjeta/i;
function sanitizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    clean[key] = SENSITIVE_KEY.test(key) ? "[oculto]" : value;
  }
  return clean;
}

// Límite por token (jti): un cliente comprometido no puede saturar la API
// aunque rote de usuario; también se limita por usuario para cubrir el caso
// de múltiples clientes autorizados por la misma persona.
onToolInvocation(async ({ auth }) => {
  const max = rateLimitMax();
  const byToken = hitRateLimit(`mcp:jti:${auth.jti}`, max, MCP_RATE_LIMIT_WINDOW_MS);
  const byUser = hitRateLimit(`mcp:user:${auth.user._id.toString()}`, max * 3, MCP_RATE_LIMIT_WINDOW_MS);
  if (byToken.limited || byUser.limited) {
    const retryAfter = Math.max(byToken.retryAfterSeconds, byUser.retryAfterSeconds);
    throw new AppError(
      `Límite de invocaciones MCP excedido; intenta de nuevo en ${retryAfter}s`,
      429
    );
  }
});

// Cada invocación (tool, parámetros sin secretos, actor, resultado) queda en
// el registro de auditoría inmutable de HU-27, con source "mcp".
onToolResult(async ({ tool, args, auth, outcome, errorMessage }) => {
  await recordAudit({
    actor: auth.user,
    action: `mcp.tool.${tool.name}`,
    resource: "mcp_tool",
    resourceId: tool.name,
    before: { clientId: auth.clientId, jti: auth.jti },
    after: { outcome, args: sanitizeArgs(args), ...(errorMessage ? { error: errorMessage } : {}) },
    source: "mcp",
  });
});
