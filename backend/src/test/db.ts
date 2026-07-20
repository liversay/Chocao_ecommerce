import { afterAll, afterEach, beforeAll } from "bun:test";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";

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
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await replset?.stop();
  });
}
