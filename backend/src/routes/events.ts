import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { logger } from "../lib/logger";
import { verifyClerkToken } from "../middlewares/auth";
import { rateLimit } from "../middlewares/rateLimit";
import { User } from "../models/User";
import { registerClient, unregisterClient, type RealtimeEvent } from "../services/realtime";
import { unreadCount } from "../services/notifications";
import type { AppEnv } from "../types";

const events = new Hono<AppEnv>();

const HEARTBEAT_MS = 25_000;

// GET /api/events — stream SSE de eventos en tiempo real: pujas y estado de
// subastas (públicos), notificaciones personales y eventos de backoffice
// (si el token pertenece a un admin). Auth OPCIONAL a propósito: un visitante
// anónimo viendo el catálogo/detalle también debe ver precios en vivo, igual
// que hoy puede ver el historial de pujas sin loguearse.
// Límite propio, no el global (app.ts lo excluye explícitamente): cuenta
// intentos de conexión/reconexión, no requests sueltas. 60/min tolera varias
// pestañas y recargas seguidas de un mismo usuario/IP sin abrir la puerta a
// un cliente reconectando en loop apretado (el backoff exponencial del
// cliente ya lo hace infrecuente por sí solo).
events.get("/", rateLimit({ name: "sse-connect", max: 60 }), async (c) => {
  const payload = await verifyClerkToken(c);
  const user = payload ? await User.findOne({ clerkId: payload.sub }) : null;

  return streamSSE(c, async (stream) => {
    let lastEventId = 0;
    const send = (event: RealtimeEvent) => {
      lastEventId += 1;
      void stream
        .writeSSE({ event: event.type, id: String(lastEventId), data: JSON.stringify(event.payload) })
        .catch((err) => {
          logger.error("sse write falló", { error: err instanceof Error ? err.message : String(err) });
        });
    };

    const clientId = registerClient({
      userId: user ? user._id.toString() : null,
      isAdmin: user?.role === "admin",
      send,
    });

    // Snapshot inicial: hidrata las campanas sin esperar al primer poll.
    await stream.writeSSE({
      event: "hello",
      data: JSON.stringify({ unreadCount: user ? await unreadCount(user) : 0 }),
    });

    const heartbeat = setInterval(() => {
      void stream.writeSSE({ event: "ping", data: "" }).catch(() => {});
    }, HEARTBEAT_MS);

    // Mantiene el handler vivo hasta que el cliente cierre la conexión;
    // stream.onAbort() dispara tanto por desconexión de red como por
    // cancelación del reader (usado en tests de integración).
    await new Promise<void>((resolve) => {
      stream.onAbort(() => {
        clearInterval(heartbeat);
        unregisterClient(clientId);
        resolve();
      });
    });
  });
});

export default events;
