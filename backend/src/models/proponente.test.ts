import { test, expect } from "bun:test";
import mongoose from "mongoose";
import { setupTestDB } from "../test/db";
import { runMigrations } from "../../scripts/migrate";
import { Proponente } from "./Proponente";

// NOTA: a diferencia de `models.test.ts` (smoke test puro de schema, sin
// conexión a Mongo), este archivo necesita ejercitar el índice único real de
// `documento.canonico` — no se puede simular con `.schema.path(...)`. Se usa
// el mismo mecanismo de conexión in-memory (`setupTestDB`, MongoMemoryReplSet)
// que ya usa el resto del proyecto para tests que dependen de comportamiento
// real de la base (ver `src/test/idempotency.integration.test.ts`).
//
// El proyecto NUNCA depende de `autoIndex` implícito de Mongoose (ver
// `src/lib/db.ts`): los índices únicos se crean por migración versionada
// (`scripts/migrations.ts`). Sin correr la migración acá, el índice único de
// `documento.canonico` puede no existir todavía cuando el segundo `create()`
// se ejecuta (carrera con la creación asíncrona del índice), dando un falso
// verde intermitente en vez de validar el comportamiento real.
setupTestDB();

test("estado por defecto es BORRADOR", () => {
  const p = new Proponente({
    userId: "507f1f77bcf86cd799439011",
    documento: { canonico: "8-888-8888", original: "8-888-8888" },
  });
  expect(p.estado).toBe("BORRADOR");
  expect(p.aceptoPliego).toBe(false);
});

test("valida el índice único de documento.canonico al guardar dos proponentes con el mismo documento", async () => {
  // `documento.categoria` es requerido por el schema (viene de
  // normalizarDocumento en el uso real) — se completa aquí para que el
  // primer create() no falle por validación y el test ejercite de verdad el
  // índice único, no un ValidationError anterior que lo enmascare.
  await runMigrations(mongoose.connection);
  await Proponente.create({
    userId: "507f1f77bcf86cd799439011",
    documento: { canonico: "8-888-8888", original: "8-888-8888", categoria: "NACIONAL" },
  });
  await expect(
    Proponente.create({
      userId: "507f1f77bcf86cd799439012",
      documento: { canonico: "8-888-8888", original: "8-888-8888", categoria: "NACIONAL" },
    })
  ).rejects.toThrow(/duplicate key|E11000/);
});
