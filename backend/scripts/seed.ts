import mongoose from "mongoose";
import "dotenv/config";
import { User } from "../src/models/User";
import { Vehicle } from "../src/models/Vehicle";
import { Bid } from "../src/models/Bid";
import { Proponente } from "../src/models/Proponente";
import { Deposito } from "../src/models/Deposito";
import { Adjudicacion } from "../src/models/Adjudicacion";
import { Payment } from "../src/models/Payment";
import { Entrega } from "../src/models/Entrega";

// Foto real de catálogo que coincide con marca/modelo/año/color, vía el CDN
// público de demo de imagin.studio (customer "img", sin API key, matching
// "best-effort": si no tiene el modelo exacto devuelve el más parecido en
// vez de fallar). paintdescription espera nombres de color en inglés.
const COLOR_EN: Record<string, string> = {
  Blanco: "white",
  Gris: "silver",
  Azul: "blue",
  Rojo: "red",
  Verde: "green",
  Negro: "black",
};

function carImageUrl(v: { brand: string; model: string; year: number; color?: string }): string {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const params = new URLSearchParams({
    customer: "img",
    make: slug(v.brand),
    modelFamily: slug(v.model),
    modelYear: String(v.year),
    angle: "01",
  });
  if (v.color) params.set("paintdescription", COLOR_EN[v.color] ?? v.color);
  return `https://cdn.imagin.studio/getImage?${params.toString()}`;
}

// Seed idempotente para demos y pruebas: upsert por clave natural
// (clerkId/email en usuarios, título en vehículos). Correrlo dos veces no
// duplica nada. NO usar en producción con datos reales.
export async function seed() {
  const [admin, ana, bruno] = await Promise.all([
    User.findOneAndUpdate(
      { clerkId: "seed-admin" },
      { clerkId: "seed-admin", name: "Admin Demo", email: "admin@chocao.demo", role: "admin" },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    ),
    User.findOneAndUpdate(
      { clerkId: "seed-ana" },
      { clerkId: "seed-ana", name: "Ana Cliente", email: "ana@chocao.demo", role: "customer" },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    ),
    User.findOneAndUpdate(
      { clerkId: "seed-bruno" },
      { clerkId: "seed-bruno", name: "Bruno Cliente", email: "bruno@chocao.demo", role: "customer" },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    ),
  ]);

  const inDays = (d: number) => new Date(Date.now() + d * 24 * 60 * 60 * 1000);

  // Custodio y auditor de demo: roles habilitados desde el Task 1, sin uso
  // real hasta las pantallas de entrega/auditoría (Tasks 9-11), pero
  // necesarios para poder iniciar sesión como esos roles en una demo manual.
  const [custodio, auditor] = await Promise.all([
    User.findOneAndUpdate(
      { clerkId: "seed-custodio" },
      { clerkId: "seed-custodio", name: "Custodio Demo", email: "custodio@chocao.demo", role: "custodio" },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    ),
    User.findOneAndUpdate(
      { clerkId: "seed-auditor" },
      { clerkId: "seed-auditor", name: "Auditor Demo", email: "auditor@chocao.demo", role: "auditor" },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    ),
  ]);

  // Proponentes ACREDITADOS de demo: sin esto, Ana/Bruno pasan el login pero
  // el gate de acreditación del Task 5 (estaAcreditado, ver services/bids.ts)
  // rechaza cualquier puja NUEVA que intenten desde la UI real — las pujas ya
  // sembradas abajo no pasan por ese gate porque se insertan directo. Estado
  // ACREDITADO es el único campo que `estaAcreditado` revisa; el resto se
  // completa de forma consistente con un flujo ya aprobado.
  const proponenteSpecs = [
    { user: ana!, documento: "8-100-1001" },
    { user: bruno!, documento: "8-100-1002" },
  ] as const;
  for (const spec of proponenteSpecs) {
    await Proponente.findOneAndUpdate(
      { userId: spec.user._id },
      {
        $set: {
          userId: spec.user._id,
          documento: { canonico: spec.documento, original: spec.documento, categoria: "NACIONAL" },
          estado: "ACREDITADO",
          aceptoPliego: true,
          aceptoPliegoEn: new Date(),
          verificacion: { estado: "APROBADO", verificadoEn: new Date() },
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
  }

  // Depósito de demo con un slot futuro disponible, para poder agendar una
  // cita de entrega desde la UI sin tener que crear el depósito a mano.
  const deposito = await Deposito.findOneAndUpdate(
    { nombre: "Depósito Central Chocao" },
    {
      $set: { nombre: "Depósito Central Chocao", direccion: "Vía España, Ciudad de Panamá", custodioIds: [custodio!._id] },
      $setOnInsert: {
        slots: [{ inicio: inDays(3), fin: inDays(3.25), capacidad: 4, ocupados: 0 }],
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  const vehicles = [
    { title: "Toyota Hilux 2021 · Flota MOP", brand: "Toyota", model: "Hilux", year: 2021, condition: "good", basePrice: 18500, status: "active", auctionStartDate: inDays(-2), auctionEndDate: inDays(5), mileage: 74000, color: "Blanco" },
    { title: "Nissan Frontier 2019 · Flota MINSA", brand: "Nissan", model: "Frontier", year: 2019, condition: "fair", basePrice: 12800, status: "active", auctionStartDate: inDays(-1), auctionEndDate: inDays(3), mileage: 112000, color: "Gris" },
    { title: "Hyundai Tucson 2022 · Incautado", brand: "Hyundai", model: "Tucson", year: 2022, condition: "excellent", basePrice: 21000, status: "published", auctionStartDate: inDays(2), auctionEndDate: inDays(9), mileage: 32000, color: "Azul" },
    { title: "Kia Rio 2018 · Flota AIG", brand: "Kia", model: "Rio", year: 2018, condition: "good", basePrice: 7400, status: "closed", auctionStartDate: inDays(-10), auctionEndDate: inDays(-1), mileage: 98000, color: "Rojo" },
    { title: "Mitsubishi L200 2017 · Flota IDAAN", brand: "Mitsubishi", model: "L200", year: 2017, condition: "poor", basePrice: 6900, status: "awarded", auctionStartDate: inDays(-20), auctionEndDate: inDays(-8), mileage: 160000, color: "Blanco" },
    { title: "Suzuki Jimny 2020 · Borrador interno", brand: "Suzuki", model: "Jimny", year: 2020, condition: "good", basePrice: 11500, status: "draft", mileage: 45000, color: "Verde" },
  ] as const;

  const savedVehicles = [];
  for (const v of vehicles) {
    savedVehicles.push(
      await Vehicle.findOneAndUpdate(
        { title: v.title },
        {
          $set: { ...v, images: [carImageUrl(v)], createdBy: admin!._id },
          $setOnInsert: { currentPrice: v.basePrice },
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      )
    );
  }

  // Pujas de demo sobre la primera subasta activa y la cerrada (idempotentes
  // por combinación vehículo+usuario+monto).
  const bidSpecs = [
    { vehicle: savedVehicles[0]!, user: ana!, amount: 19000, status: "outbid" },
    { vehicle: savedVehicles[0]!, user: bruno!, amount: 19800, status: "active" },
    { vehicle: savedVehicles[3]!, user: ana!, amount: 8100, status: "winner" },
  ] as const;

  for (const spec of bidSpecs) {
    await Bid.findOneAndUpdate(
      { vehicleId: spec.vehicle._id, userId: spec.user._id, amount: spec.amount },
      { $set: { status: spec.status } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    if (spec.status !== "winner" && spec.vehicle.currentPrice < spec.amount) {
      spec.vehicle.currentPrice = spec.amount;
      await spec.vehicle.save();
    }
  }

  // Flujo de entrega de demo: el Mitsubishi L200 (ya `awarded`) se completa
  // con vin, puja ganadora, adjudicación PAGADA, pago pagado y una Entrega
  // con cita agendada, para poder mostrar la pantalla de entrega/custodio sin
  // tener que recorrer manualmente todo el flujo de subasta+pago primero.
  const l200 = savedVehicles[4]!;
  if (!l200.vin) {
    l200.vin = "8XATL200SEEDDEMO1";
    await l200.save();
  }

  const l200Bid = await Bid.findOneAndUpdate(
    { vehicleId: l200._id, userId: bruno!._id, amount: 7200 },
    { $set: { status: "winner" } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  const l200Adjudicacion = await Adjudicacion.findOneAndUpdate(
    { vehicleId: l200._id },
    {
      $set: { estado: "PAGADA" },
      $setOnInsert: {
        vehicleId: l200._id,
        ganadorBidId: l200Bid._id,
        fechaActo: inDays(-7),
        fechaLimitePago: inDays(-4),
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  const l200Payment = await Payment.findOneAndUpdate(
    { referenciaPago: "seed-ref-l200" },
    {
      $set: { status: "paid", paidAt: inDays(-5) },
      $setOnInsert: {
        userId: bruno!._id,
        vehicleId: l200._id,
        bidId: l200Bid._id,
        amount: 7200,
        referenciaPago: "seed-ref-l200",
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  await Entrega.findOneAndUpdate(
    { adjudicacionId: l200Adjudicacion._id },
    {
      $set: { citaProgramadaEn: inDays(3), estado: "CITA_AGENDADA" },
      $setOnInsert: {
        adjudicacionId: l200Adjudicacion._id,
        vehicleId: l200._id,
        paymentId: l200Payment._id,
        compradorId: bruno!._id,
        depositoId: deposito!._id,
        custodioId: custodio!._id,
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  return {
    users: await User.countDocuments({ clerkId: /^seed-/ }),
    vehicles: await Vehicle.countDocuments({ title: { $in: vehicles.map((v) => v.title) } }),
    bids: await Bid.countDocuments({}),
  };
}

if (import.meta.main) {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI no está definida");
  await mongoose.connect(uri);
  const result = await seed();
  console.log(`[seed] listo — usuarios seed: ${result.users}, vehículos seed: ${result.vehicles}, pujas totales: ${result.bids}`);
  await mongoose.disconnect();
}
