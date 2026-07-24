// Servidor efímero para las pruebas E2E de Playwright (modo autocontenido).
// Levanta un MongoDB en memoria (la misma infra que la suite de bun test),
// siembra un dataset FIJO y sirve la app real en :3000 con E2E=1 activo
// (atajo de auth "Bearer e2e:<clerkId>" + Stripe fake en lib/stripe.ts).
// No arranca el job de cierre de subastas: los estados vienen sembrados y
// así ningún tick de fondo altera los datos a mitad de un test.
// Asignación DIRECTA (no ||=): Bun auto-carga backend/.env, que apunta al
// frontend de desarrollo (5173). El modo E2E vive en 5174 y debe ignorar esa
// configuración — si no, CORS rechaza todas las llamadas del navegador E2E.
process.env.E2E = "1";
process.env.STRIPE_SUCCESS_URL = "http://localhost:5174/checkout/success";
process.env.STRIPE_CANCEL_URL = "http://localhost:5174/checkout/cancel";
process.env.FRONTEND_URL = "http://localhost:5174";
process.env.ALLOWED_ORIGINS = "http://localhost:5174";

import { serve } from "@hono/node-server";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";

import { createApp } from "../src/app";
import { logger } from "../src/lib/logger";
import { Bid } from "../src/models/Bid";
import { Deposito } from "../src/models/Deposito";
import { Payment } from "../src/models/Payment";
import { Proponente } from "../src/models/Proponente";
import { User } from "../src/models/User";
import { Vehicle } from "../src/models/Vehicle";

const IN_7_DAYS = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

async function seed() {
  const [admin, ana, bruno, custodio] = await Promise.all([
    User.create({ clerkId: "e2e_admin", name: "Admin E2E", email: "admin@e2e.test", role: "admin" }),
    User.create({ clerkId: "e2e_ana", name: "Ana E2E", email: "ana@e2e.test", role: "customer" }),
    User.create({ clerkId: "e2e_bruno", name: "Bruno E2E", email: "bruno@e2e.test", role: "customer" }),
    User.create({ clerkId: "e2e_custodio", name: "Custodio E2E", email: "custodio@e2e.test", role: "custodio" }),
  ]);

  // Proponentes ACREDITADOS para Ana y Bruno: sin esto, el gate de
  // acreditación del Task 5 (estaAcreditado, ver services/bids.ts) rechaza
  // el POST /api/bids/vehicle/:id real que dispara el botón "Pujar" en
  // 01-bidding.spec.ts, y VehicleDetailPage tampoco renderiza ese botón para
  // un usuario no acreditado — este fixture es lo que mantiene esos specs
  // funcionando sin tocarlos.
  await Promise.all([
    Proponente.create({
      userId: ana._id,
      documento: { canonico: "8-200-2001", original: "8-200-2001", categoria: "NACIONAL" },
      estado: "ACREDITADO",
      aceptoPliego: true,
      aceptoPliegoEn: new Date(),
      verificacion: { estado: "APROBADO", verificadoEn: new Date() },
    }),
    Proponente.create({
      userId: bruno._id,
      documento: { canonico: "8-200-2002", original: "8-200-2002", categoria: "NACIONAL" },
      estado: "ACREDITADO",
      aceptoPliego: true,
      aceptoPliegoEn: new Date(),
      verificacion: { estado: "APROBADO", verificadoEn: new Date() },
    }),
  ]);

  await Deposito.create({
    nombre: "Depósito E2E",
    direccion: "Zona Libre E2E",
    custodioIds: [custodio._id],
    slots: [{ inicio: IN_7_DAYS(), fin: new Date(IN_7_DAYS().getTime() + 60 * 60 * 1000), capacidad: 4, ocupados: 0 }],
  });

  await Vehicle.create({
    title: "Corolla E2E",
    brand: "Toyota",
    model: "Corolla",
    year: 2021,
    condition: "good",
    basePrice: 10_000,
    currentPrice: 10_000,
    status: "active",
    auctionEndDate: IN_7_DAYS(),
  });

  await Vehicle.create({
    title: "Civic E2E",
    brand: "Honda",
    model: "Civic",
    year: 2020,
    condition: "excellent",
    basePrice: 8_000,
    currentPrice: 8_000,
    status: "active",
    auctionEndDate: IN_7_DAYS(),
  });

  // Subasta ya cerrada con puja ganadora de Ana → deja listo el flujo de pago
  const f150 = await Vehicle.create({
    title: "F-150 E2E",
    brand: "Ford",
    model: "F-150",
    year: 2019,
    condition: "good",
    basePrice: 12_000,
    currentPrice: 15_000,
    status: "closed",
    auctionEndDate: new Date(Date.now() - 60 * 60 * 1000),
  });
  await Bid.create({ vehicleId: f150._id, userId: ana._id, amount: 15_000, status: "winner" });
  await Bid.create({ vehicleId: f150._id, userId: bruno._id, amount: 14_000, status: "outbid" });

  // Compra ya PAGADA por Bruno → deja listo el flujo de reembolso del admin
  // sin depender de que otro spec haya pagado antes.
  const ranger = await Vehicle.create({
    title: "Ranger E2E",
    brand: "Ford",
    model: "Ranger",
    year: 2018,
    condition: "fair",
    basePrice: 11_000,
    currentPrice: 13_000,
    status: "awarded",
    auctionEndDate: new Date(Date.now() - 2 * 60 * 60 * 1000),
  });
  const rangerBid = await Bid.create({
    vehicleId: ranger._id,
    userId: bruno._id,
    amount: 13_000,
    status: "paid",
  });
  await Payment.create({
    userId: bruno._id,
    vehicleId: ranger._id,
    bidId: rangerBid._id,
    stripeSessionId: "cs_seed_paid_ranger",
    amount: 13_000,
    status: "paid",
  });

  logger.info("seed E2E listo", {
    admin: admin.clerkId,
    ana: ana.clerkId,
    bruno: bruno.clerkId,
    custodio: custodio.clerkId,
  });
}

const replset = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
await mongoose.connect(replset.getUri("chocao_e2e"));
await seed();

const app = createApp();
const PORT = parseInt(process.env.PORT || "3000");
serve({ fetch: app.fetch, port: PORT }, () => {
  logger.info(`Chocao API (modo E2E) en http://localhost:${PORT}`);
});
