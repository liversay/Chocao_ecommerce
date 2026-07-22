// Tipos de los eventos que publica el backend (backend/src/services/realtime.ts).
// Mantener en sync manualmente — no hay generación de tipos compartida entre
// backend y frontend en este proyecto.
export type RealtimeEventType =
  | "notification"
  | "bid.placed"
  | "vehicle.status"
  | "vehicle.updated"
  | "vehicle.removed"
  | "order.updated"
  | "user.updated"
  | "watchlist.updated";

export interface RealtimeEventPayloads {
  notification: {
    id: string;
    type: "outbid" | "won" | "payment_confirmed" | "refunded" | "watch_closing";
    title: string;
    body: string;
    data?: { vehicleId?: string; bidId?: string; paymentId?: string };
    createdAt: string;
  };
  "bid.placed": { vehicleId: string; currentPrice: number; amount: number; createdAt: string };
  "vehicle.status": { vehicleId: string; status: string };
  "vehicle.updated": { vehicleId: string };
  "vehicle.removed": { vehicleId: string };
  "order.updated": { paymentId: string; status: string };
  "user.updated": { userId: string };
  "watchlist.updated": { vehicleId: string; action: "added" | "removed" };
}

export type RealtimeHandler<T extends RealtimeEventType> = (payload: RealtimeEventPayloads[T]) => void;
