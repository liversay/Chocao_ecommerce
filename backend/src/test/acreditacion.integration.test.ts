import "./mocks/clerk";
import { beforeAll, describe, expect, test } from "bun:test";
import mongoose from "mongoose";
import { createApp } from "../app";
import { Proponente } from "../models/Proponente";
import { runMigrations } from "../../scripts/migrate";
import { setupTestDB } from "./db";
import { authHeader, createUser } from "./factories";

setupTestDB();
const app = createApp();

// La unicidad de documento (RI-03) y de proponente por usuario está impuesta
// a nivel de base de datos por la migración 4 (autoIndex está deshabilitado
// globalmente) — sin correrla, un duplicado podría colarse si algún día el
// chequeo a nivel de aplicación tuviera un hueco de carrera.
beforeAll(async () => {
  await runMigrations(mongoose.connection);
});

interface ProponenteJSON {
  _id: string;
  estado: string;
  motivoRechazo?: string;
  documento: { canonico: string };
}

function crearBorrador(user: Awaited<ReturnType<typeof createUser>>, documento: string) {
  return app.request("/api/acreditacion", {
    method: "POST",
    headers: authHeader(user),
    body: JSON.stringify({ documento }),
  });
}

function aceptarPliego(user: Awaited<ReturnType<typeof createUser>>) {
  return app.request("/api/acreditacion/pliego", {
    method: "PATCH",
    headers: authHeader(user),
    body: JSON.stringify({ aceptoPliego: true }),
  });
}

function enviarARevision(user: Awaited<ReturnType<typeof createUser>>) {
  return app.request("/api/acreditacion/enviar", {
    method: "POST",
    headers: authHeader(user),
  });
}

describe("acreditación de proponentes (RI-01/RI-03)", () => {
  test("flujo feliz: borrador -> revisión -> acreditado, y pliego rechaza sin aceptar", async () => {
    const user = await createUser();

    const crear = await crearBorrador(user, "8-888-8888");
    expect(crear.status).toBe(201);
    const creado = (await crear.json()) as ProponenteJSON;
    expect(creado.estado).toBe("BORRADOR");

    // RA-10: no se puede enviar a revisión sin aceptar el pliego primero.
    const sinPliego = await enviarARevision(user);
    expect(sinPliego.status).toBe(400);

    const pliego = await aceptarPliego(user);
    expect(pliego.status).toBe(200);

    const enviar = await enviarARevision(user);
    expect(enviar.status).toBe(200);
    const enviado = (await enviar.json()) as ProponenteJSON;
    // El mock de identidad aprueba cualquier documento que no termine en
    // "0000" (backend/src/lib/providers/identity.ts) — "8-888-8888" aprueba.
    expect(enviado.estado).toBe("ACREDITADO");

    const me = await app.request("/api/acreditacion/me", { headers: authHeader(user) });
    expect(me.status).toBe(200);
    expect(((await me.json()) as ProponenteJSON).estado).toBe("ACREDITADO");
  });

  test("dos usuarios con el mismo documento canónico: el segundo es rechazado (RI-03)", async () => {
    const userA = await createUser();
    const userB = await createUser();

    expect((await crearBorrador(userA, "8-888-8888")).status).toBe(201);
    expect((await aceptarPliego(userA)).status).toBe(200);
    const enviarA = await enviarARevision(userA);
    expect(enviarA.status).toBe(200);
    expect(((await enviarA.json()) as ProponenteJSON).estado).toBe("ACREDITADO");

    // Misma forma canónica, distinta forma escrita.
    const dup = await crearBorrador(userB, "8 - 888 - 8888");
    expect(dup.status).toBe(409);
  });

  test("admin puede listar y aprobar/rechazar una acreditación en EN_REVISION", async () => {
    const admin = await createUser({ role: "admin" });
    const proponenteUser = await createUser();

    const crear = await crearBorrador(proponenteUser, "9-777-7777");
    expect(crear.status).toBe(201);
    const creado = (await crear.json()) as ProponenteJSON;

    // El servicio actual resuelve la verificación automáticamente
    // (ACREDITADO/RECHAZADO) y nunca deja al proponente en EN_REVISION por sí
    // mismo; ese estado del modelo existe para cuando un revisor humano deba
    // intervenir manualmente (revisarAcreditacion), así que lo simulamos
    // directamente en la base para ejercitar ese camino de backoffice.
    await Proponente.updateOne({ _id: creado._id }, { estado: "EN_REVISION" });

    // Un proponente (no revisor) no puede listar acreditaciones ajenas.
    const forbidden = await app.request("/api/acreditacion?estado=EN_REVISION", {
      headers: authHeader(proponenteUser),
    });
    expect(forbidden.status).toBe(403);

    const listado = await app.request("/api/acreditacion?estado=EN_REVISION", {
      headers: authHeader(admin),
    });
    expect(listado.status).toBe(200);
    const listadoBody = (await listado.json()) as { items: ProponenteJSON[] };
    expect(listadoBody.items.some((p) => p._id === creado._id)).toBe(true);

    const revisar = await app.request(`/api/acreditacion/${creado._id}/revisar`, {
      method: "PATCH",
      headers: authHeader(admin),
      body: JSON.stringify({ decision: "RECHAZAR", motivoRechazo: "DOCUMENTO_INVALIDO" }),
    });
    expect(revisar.status).toBe(200);
    const revisado = (await revisar.json()) as ProponenteJSON;
    expect(revisado.estado).toBe("RECHAZADO");
    expect(revisado.motivoRechazo).toBe("DOCUMENTO_INVALIDO");
  });
});
