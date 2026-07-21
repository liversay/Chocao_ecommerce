import mongoose from "mongoose";
import "dotenv/config";
import { User } from "../src/models/User";
import { Vehicle } from "../src/models/Vehicle";
import { Bid } from "../src/models/Bid";

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
        { $set: { ...v, createdBy: admin!._id }, $setOnInsert: { currentPrice: v.basePrice } },
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
