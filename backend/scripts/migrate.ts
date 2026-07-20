import mongoose from "mongoose";
import "dotenv/config";
import { migrations, type Migration } from "./migrations";

// Runner de migraciones: aplica en orden las versiones que falten y registra
// cada una en la colección `migrations`. Idempotente — correr dos veces no
// re-aplica nada. Se ejecuta en cada arranque de producción (bun run start).
export async function runMigrations(
  connection: mongoose.Connection,
  list: Migration[] = migrations
) {
  const collection = connection.db!.collection("migrations");
  const appliedDocs = await collection.find({}).toArray();
  const appliedVersions = new Set(appliedDocs.map((d) => d.version as number));

  const pending = list
    .filter((m) => !appliedVersions.has(m.version))
    .sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    console.log(`[migrate] aplicando ${migration.version} · ${migration.name}`);
    await migration.up(connection);
    await collection.insertOne({
      version: migration.version,
      name: migration.name,
      appliedAt: new Date(),
    });
  }

  return { applied: pending.map((m) => m.version), skipped: [...appliedVersions] };
}

if (import.meta.main) {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI no está definida");
  await mongoose.connect(uri);
  const result = await runMigrations(mongoose.connection);
  console.log(
    `[migrate] listo — aplicadas: [${result.applied.join(", ") || "ninguna"}], ya presentes: [${result.skipped.join(", ") || "ninguna"}]`
  );
  await mongoose.disconnect();
}
