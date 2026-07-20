import { afterAll, afterEach, beforeAll } from "bun:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { defaultStore } from "../middlewares/rateLimit";

// Levanta un MongoDB efímero en memoria para el archivo de test que lo llame.
// Se usa replSet (1 nodo) para que las transacciones de Mongo funcionen en
// los tests de concurrencia (HU-21).
export function setupTestDB() {
  let replset: MongoMemoryReplSet;

  beforeAll(async () => {
    replset = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replset.getUri("chocao_test"));
  }, 120_000);

  afterEach(async () => {
    const collections = await mongoose.connection.db!.collections();
    await Promise.all(collections.map((c) => c.deleteMany({})));
    // El rate limiter global es un singleton de módulo compartido por TODO
    // el proceso de test (todos los archivos importan el mismo defaultStore).
    // Sin este reset, la suite completa acumula peticiones de archivos
    // anteriores y empieza a devolver 429 en tests que no tienen nada que
    // ver con rate limiting.
    defaultStore.reset();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await replset?.stop();
  });
}
