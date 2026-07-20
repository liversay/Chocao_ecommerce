import type mongoose from "mongoose";

export interface Migration {
  version: number;
  name: string;
  up: (connection: mongoose.Connection) => Promise<void>;
}

// Migraciones versionadas. Añadir siempre al final con el siguiente número;
// nunca editar una migración ya aplicada.
export const migrations: Migration[] = [
  {
    version: 1,
    name: "indices-iniciales",
    up: async (connection) => {
      const db = connection.db!;
      await db.collection("users").createIndex({ clerkId: 1 }, { unique: true });
      await db.collection("users").createIndex({ email: 1 }, { unique: true });
      // catálogo: filtros por estado + cierre de subastas vencidas
      await db.collection("vehicles").createIndex({ status: 1, auctionEndDate: 1 });
      await db.collection("vehicles").createIndex({ brand: 1, currentPrice: 1 });
      // pujas: historial por vehículo ordenado por monto, y "mis pujas"
      await db.collection("bids").createIndex({ vehicleId: 1, amount: -1 });
      await db.collection("bids").createIndex({ userId: 1, status: 1 });
      // pagos: búsqueda por sesión de Stripe
      await db
        .collection("payments")
        .createIndex({ stripeSessionId: 1 }, { unique: true, sparse: true });
      // auditoría (HU-27)
      await db.collection("auditlogs").createIndex({ createdAt: -1 });
      await db.collection("auditlogs").createIndex({ resource: 1, resourceId: 1 });
    },
  },
];
