import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";

import { errorHandler } from "./lib/errors";
import { httpLogger, requestId } from "./middlewares/logging";
import { rateLimit } from "./middlewares/rateLimit";
import auditRouter from "./routes/audit";
import eventsRouter from "./routes/events";
import healthRouter from "./routes/health";
import mcpRouter from "./mcp";
import oauthRouter from "./oauth/router";
import usersRouter from "./routes/users";
import vehiclesRouter from "./routes/vehicles";
import bidsRouter from "./routes/bids";
import paymentsRouter from "./routes/payments";
import dashboardRouter from "./routes/dashboard";
import notificationsRouter from "./routes/notifications";
import watchlistRouter from "./routes/watchlist";
import acreditacionRouter from "./routes/acreditacion";
import type { AppEnv } from "./types";

// CORS estricto: solo los orígenes de la lista blanca (ALLOWED_ORIGINS, CSV).
// Nada de "*": un origen fuera de la lista no recibe cabeceras CORS.
export function allowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || "http://localhost:5173";
  return raw.split(",").map((o) => o.trim()).filter(Boolean);
}

export function createApp() {
  const app = new Hono<AppEnv>();

  app.use("*", secureHeaders());
  app.use(
    "*",
    cors({
      origin: (origin) => (allowedOrigins().includes(origin) ? origin : null),
      allowHeaders: ["Content-Type", "Authorization", "X-Request-Id", "Mcp-Protocol-Version", "Mcp-Session-Id"],
      exposeHeaders: ["X-Request-Id", "Mcp-Session-Id", "WWW-Authenticate"],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    })
  );
  app.use("*", requestId);
  app.use("*", httpLogger);
  // Límite global de payload (las imágenes viajan como URLs de Cloudinary,
  // no en base64, así que 1 MB alcanza de sobra).
  app.use(
    "*",
    bodyLimit({
      maxSize: 1024 * 1024,
      onError: (c) => c.json({ error: "El cuerpo de la petición supera el tamaño permitido" }, 413),
    })
  );
  // Límite global por IP; las rutas sensibles añaden límites más estrictos.
  // /api/events (SSE) queda fuera: es una conexión larga, no una ráfaga de
  // requests, y su propio límite vive en routes/events.ts — compartir el
  // presupuesto global con reconexiones (por red inestable, JWT vencido, o
  // incluso muchos visitantes anónimos detrás del mismo NAT) podía agotarlo
  // y devolver 429 al resto de la API para ese cliente.
  app.use("*", rateLimit({ name: "global", max: 300, skip: (c) => c.req.path === "/api/events" }));

  app.get("/", (c) => c.json({ message: "Chocao API running" }));
  app.route("/", healthRouter);

  app.route("/api/users", usersRouter);
  app.route("/api/vehicles", vehiclesRouter);
  app.route("/api/bids", bidsRouter);
  app.route("/api/payments", paymentsRouter);
  app.route("/api/dashboard", dashboardRouter);
  app.route("/api/audit", auditRouter);
  app.route("/api/notifications", notificationsRouter);
  app.route("/api/watchlist", watchlistRouter);
  app.route("/api/acreditacion", acreditacionRouter);
  app.route("/api/events", eventsRouter);

  // Servidor MCP (Streamable HTTP) + Authorization Server OAuth 2.1
  app.route("/", oauthRouter);
  app.route("/mcp", mcpRouter);

  app.notFound((c) => c.json({ error: "Recurso no encontrado" }, 404));
  app.onError(errorHandler);

  return app;
}
