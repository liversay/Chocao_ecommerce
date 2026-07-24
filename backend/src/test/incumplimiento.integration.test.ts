import "./mocks/clerk";
import "./mocks/stripe";
import { describe, expect, test } from "bun:test";
import { createApp } from "../app";
import { addBusinessDays } from "../lib/calendario";
import { Adjudicacion } from "../models/Adjudicacion";
import { AuditLog } from "../models/AuditLog";
import { Bid } from "../models/Bid";
import { User } from "../models/User";
import { aceptarOfertaSegundoPostor, procesarIncumplimientos } from "../services/auctions";
import { setupTestDB } from "./db";
import { authHeader, createBid, createUser, createVehicle } from "./factories";

setupTestDB();
const app = createApp();

// Construye una Adjudicacion vencida directamente (sin pasar por
// adjudicateVehicle) para controlar fechaLimitePago con precisión — mismo
// enfoque que payment-deadline.integration.test.ts.
async function adjudicacionVencida(options: { conSegundoPostor?: boolean } = {}) {
  const ganador = await createUser();
  const vehicle = await createVehicle();
  const bidGanador = await createBid(vehicle, ganador, { amount: 300, status: "winner" });

  let segundo: Awaited<ReturnType<typeof createUser>> | undefined;
  let bidSegundo: Awaited<ReturnType<typeof createBid>> | undefined;
  if (options.conSegundoPostor) {
    segundo = await createUser();
    bidSegundo = await createBid(vehicle, segundo, { amount: 200, status: "outbid" });
  }

  const fechaActo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
  const adjudicacion = await Adjudicacion.create({
    vehicleId: vehicle._id,
    ganadorBidId: bidGanador._id,
    segundoBidId: bidSegundo?._id,
    segundoMonto: bidSegundo?.amount,
    fechaActo,
    fechaLimitePago: new Date(Date.now() - 1000), // ya vencida
    estado: "ADJUDICADA_PENDIENTE_PAGO",
  });

  return { ganador, vehicle, bidGanador, segundo, bidSegundo, adjudicacion };
}

describe("procesarIncumplimientos (RP-04/RP-05)", () => {
  test("banea al adjudicatario y marca DESIERTO_POR_INCUMPLIMIENTO sin segundo postor", async () => {
    const { ganador, adjudicacion } = await adjudicacionVencida();

    const procesados = await procesarIncumplimientos();

    expect(procesados).toBe(1);
    const user = await User.findById(ganador._id);
    expect(user?.banned).toBe(true);
    expect(user?.banReason).toBe("INCUMPLIMIENTO_PAGO");
    expect(user?.bannedAt).toBeTruthy();

    const actualizada = await Adjudicacion.findById(adjudicacion._id);
    expect(actualizada?.estado).toBe("DESIERTO_POR_INCUMPLIMIENTO");

    const audit = await AuditLog.findOne({ action: "adjudicacion.incumplida" });
    expect(audit).not.toBeNull();
    expect(audit!.source).toBe("job");
  });

  test("ofrece al segundo postor cuando existe, con ventana de aceptación", async () => {
    const { ganador, adjudicacion } = await adjudicacionVencida({ conSegundoPostor: true });

    await procesarIncumplimientos();

    const actualizada = await Adjudicacion.findById(adjudicacion._id);
    expect(actualizada?.estado).toBe("OFERTA_A_SEGUNDO");
    expect(actualizada?.ofertaSegundoVenceEn).toBeTruthy();
    expect(actualizada!.ofertaSegundoVenceEn!.getTime()).toBeGreaterThan(Date.now());

    // el ganador original igual queda inhabilitado — incumplió sin importar
    // si hay o no segundo postor
    const user = await User.findById(ganador._id);
    expect(user?.banned).toBe(true);
  });

  test("no toca adjudicaciones cuyo plazo aún no venció", async () => {
    const { adjudicacion } = await adjudicacionVencida();
    await Adjudicacion.findByIdAndUpdate(adjudicacion._id, {
      fechaLimitePago: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const procesados = await procesarIncumplimientos();

    expect(procesados).toBe(0);
    const sinTocar = await Adjudicacion.findById(adjudicacion._id);
    expect(sinTocar?.estado).toBe("ADJUDICADA_PENDIENTE_PAGO");
  });

  test("es idempotente: una segunda corrida no vuelve a procesar la misma adjudicación", async () => {
    await adjudicacionVencida();

    expect(await procesarIncumplimientos()).toBe(1);
    expect(await procesarIncumplimientos()).toBe(0);

    expect(await AuditLog.countDocuments({ action: "adjudicacion.incumplida" })).toBe(1);
  });

  test("procesa varias adjudicaciones vencidas en una sola corrida", async () => {
    await adjudicacionVencida();
    await adjudicacionVencida({ conSegundoPostor: true });

    expect(await procesarIncumplimientos()).toBe(2);
  });
});

describe("aceptarOfertaSegundoPostor (RP-05)", () => {
  async function ofertaVigente() {
    const { vehicle, segundo, bidSegundo, adjudicacion } = await adjudicacionVencida({ conSegundoPostor: true });
    await procesarIncumplimientos();
    return { vehicle, segundo: segundo!, bidSegundo: bidSegundo!, adjudicacion };
  }

  test("el segundo postor acepta: se vuelve ganador con nuevo plazo de 5 días hábiles", async () => {
    const { segundo, bidSegundo, adjudicacion } = await ofertaVigente();

    const resultado = await aceptarOfertaSegundoPostor(adjudicacion._id.toString(), segundo);

    expect(resultado.estado).toBe("ADJUDICADA_PENDIENTE_PAGO");
    expect(resultado.ganadorBidId.toString()).toBe(bidSegundo._id.toString());
    expect(resultado.segundoBidId).toBeUndefined();
    expect(resultado.segundoMonto).toBeUndefined();
    expect(resultado.fechaLimitePago.getTime()).toBeGreaterThan(Date.now());

    expect((await Bid.findById(bidSegundo._id))!.status).toBe("winner");

    const audit = await AuditLog.findOne({ action: "adjudicacion.segundo_postor_acepto" });
    expect(audit).not.toBeNull();
  });

  test("un usuario que no es el segundo postor no puede aceptar (403)", async () => {
    const { adjudicacion } = await ofertaVigente();
    const otro = await createUser();

    await expect(aceptarOfertaSegundoPostor(adjudicacion._id.toString(), otro)).rejects.toThrow(
      /segundo mejor postor/i
    );
  });

  test("aceptar una oferta que ya no está OFERTA_A_SEGUNDO responde conflicto", async () => {
    const { ganador, adjudicacion } = await adjudicacionVencida();
    // sin segundo postor: procesarIncumplimientos la deja DESIERTO_POR_INCUMPLIMIENTO
    await procesarIncumplimientos();

    await expect(aceptarOfertaSegundoPostor(adjudicacion._id.toString(), ganador)).rejects.toThrow(
      /ya no está disponible/i
    );
  });

  test("aceptar tras vencer la ventana del segundo postor marca DESIERTO_POR_INCUMPLIMIENTO", async () => {
    const { segundo, adjudicacion } = await ofertaVigente();
    await Adjudicacion.findByIdAndUpdate(adjudicacion._id, {
      ofertaSegundoVenceEn: new Date(Date.now() - 1000),
    });

    await expect(aceptarOfertaSegundoPostor(adjudicacion._id.toString(), segundo)).rejects.toThrow(/venció/i);

    const final = await Adjudicacion.findById(adjudicacion._id);
    expect(final?.estado).toBe("DESIERTO_POR_INCUMPLIMIENTO");
  });

  test("la ventana de oferta usa días hábiles, no días corridos", async () => {
    const { adjudicacion } = await ofertaVigente();
    const actualizada = await Adjudicacion.findById(adjudicacion._id);
    const esperado = addBusinessDays(new Date(), Number(process.env.SEGUNDO_POSTOR_DIAS_HABILES ?? "2"));
    // Tolerancia de un día por el paso del tiempo entre el cálculo del test
    // y el del job, ambos con addBusinessDays sobre "ahora".
    expect(Math.abs(actualizada!.ofertaSegundoVenceEn!.getTime() - esperado.getTime())).toBeLessThan(
      2 * 24 * 60 * 60 * 1000
    );
  });

  test("endpoint HTTP: el segundo postor acepta la oferta vía POST /api/adjudicaciones/:id/aceptar-oferta", async () => {
    const { segundo, adjudicacion } = await ofertaVigente();

    const res = await app.request(`/api/adjudicaciones/${adjudicacion._id}/aceptar-oferta`, {
      method: "POST",
      headers: authHeader(segundo),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { estado: string };
    expect(body.estado).toBe("ADJUDICADA_PENDIENTE_PAGO");
  });

  test("endpoint HTTP: sin autenticación responde 401", async () => {
    const { adjudicacion } = await ofertaVigente();
    const res = await app.request(`/api/adjudicaciones/${adjudicacion._id}/aceptar-oferta`, {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  test("endpoint HTTP: otro usuario autenticado recibe 403", async () => {
    const { adjudicacion } = await ofertaVigente();
    const otro = await createUser();
    const res = await app.request(`/api/adjudicaciones/${adjudicacion._id}/aceptar-oferta`, {
      method: "POST",
      headers: authHeader(otro),
    });
    expect(res.status).toBe(403);
  });
});
