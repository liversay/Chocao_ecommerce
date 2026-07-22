import type { Types } from "mongoose";
import { logger } from "../lib/logger";

// Hub de eventos en tiempo real en memoria (una sola instancia — no hay
// Redis/pub-sub en este despliegue). Los servicios de negocio publican aquí
// en el mismo punto donde ya mutan datos; la ruta SSE (routes/events.ts) es
// la única que registra/desregistra clientes y hace el fan-out a cada stream.
//
// Nota para escalar a varias instancias: sustituir este Map en memoria por
// un backend de pub/sub compartido (p. ej. Redis) detrás de la misma API
// (registerClient/unregisterClient quedarían iguales; publish* pasarían a
// publicar en el canal compartido en vez de iterar `clients`).

export type RealtimeEvent =
  | {
      type: "notification";
      payload: {
        id: string;
        type: string;
        title: string;
        body: string;
        data?: unknown;
        createdAt: Date;
      };
    }
  | {
      type: "bid.placed";
      payload: { vehicleId: string; currentPrice: number; amount: number; createdAt: Date };
    }
  | { type: "vehicle.status"; payload: { vehicleId: string; status: string } }
  | { type: "vehicle.updated"; payload: { vehicleId: string } }
  | { type: "vehicle.removed"; payload: { vehicleId: string } }
  | { type: "order.updated"; payload: { paymentId: string; status: string } }
  | { type: "user.updated"; payload: { userId: string } }
  | { type: "watchlist.updated"; payload: { vehicleId: string; action: "added" | "removed" } };

export interface RealtimeClient {
  id: string;
  /** null para conexiones anónimas (visitantes viendo el catálogo/detalle) */
  userId: string | null;
  isAdmin: boolean;
  send: (event: RealtimeEvent) => void;
}

const clients = new Map<string, RealtimeClient>();

export function registerClient(client: Omit<RealtimeClient, "id">): string {
  const id = crypto.randomUUID();
  clients.set(id, { ...client, id });
  return id;
}

export function unregisterClient(id: string) {
  clients.delete(id);
}

export function connectedClientCount(): number {
  return clients.size;
}

function safeSend(client: RealtimeClient, event: RealtimeEvent) {
  try {
    client.send(event);
  } catch (err) {
    // Un cliente roto no debe interrumpir el fan-out a los demás — mismo
    // criterio de aislamiento de fallos que notify()/recordAudit().
    logger.error("no se pudo enviar evento SSE", {
      clientId: client.id,
      type: event.type,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function publishToUser(userId: Types.ObjectId | string, event: RealtimeEvent) {
  const uid = userId.toString();
  for (const client of clients.values()) {
    if (client.userId === uid) safeSend(client, event);
  }
}

export function publishToAdmins(event: RealtimeEvent) {
  for (const client of clients.values()) {
    if (client.isAdmin) safeSend(client, event);
  }
}

export function publishPublic(event: RealtimeEvent) {
  for (const client of clients.values()) {
    safeSend(client, event);
  }
}
