import type { Context, Next } from "hono";
import { logger } from "../lib/logger";
import type { AppEnv } from "../types";

const REQUEST_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

// Acepta el X-Request-Id del cliente (si tiene un formato sano) o genera uno,
// lo deja en el contexto para logs/errores y lo devuelve en la respuesta para
// poder correlacionar frontend ↔ backend.
export async function requestId(c: Context<AppEnv>, next: Next) {
  const incoming = c.req.header("X-Request-Id");
  const id = incoming && REQUEST_ID_RE.test(incoming) ? incoming : crypto.randomUUID();
  c.set("requestId", id);
  c.header("X-Request-Id", id);
  await next();
}

// Una línea JSON por request con método, ruta, status, duración y actor.
export async function httpLogger(c: Context<AppEnv>, next: Next) {
  const start = performance.now();
  await next();
  const user = c.get("user");
  logger.info("http", {
    requestId: c.get("requestId"),
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    durationMs: Math.round(performance.now() - start),
    ...(user ? { userId: user._id.toString() } : {}),
  });
}
