import { addBusinessDays } from "../lib/calendario";
import { logger } from "../lib/logger";
import { ConflictError, ForbiddenError, NotFoundError } from "../lib/errors";
import { Adjudicacion, type AdjudicacionDoc } from "../models/Adjudicacion";
import { Bid } from "../models/Bid";
import { Vehicle, type IVehicle, type VehicleDoc } from "../models/Vehicle";
import { recordAudit } from "./audit";
import { invalidateCatalog } from "./vehicles";
import { User, type UserDoc } from "../models/User";
import { notify, notifyMany } from "./notifications";
import { publishPublic } from "./realtime";
import { Watchlist } from "../models/Watchlist";

const DIAS_HABILES_PAGO = 5;
const SEGUNDO_POSTOR_DIAS_HABILES = Number(process.env.SEGUNDO_POSTOR_DIAS_HABILES ?? "2");

// Adjudicación (RP-01/RP-02): la puja más alta del vehículo queda winner, el
// resto outbid, y se persiste el acto formal en Adjudicacion con el segundo
// mejor postor (para RP-05 si el ganador incumple) y el plazo legal de pago
// de 5 días hábiles. Idempotente — re-ejecutarla no cambia el resultado. La
// comparten el cambio de estado manual (ruta admin), el job de cierre
// automático y la futura tool MCP chocao_set_vehicle_status.
export async function adjudicateVehicle(vehicleId: string): Promise<string | undefined> {
  const ranking = await Bid.find({ vehicleId }).sort({ amount: -1, createdAt: 1 });
  if (ranking.length === 0) return undefined;

  const highestBid = ranking[0]!;
  const secondBid = ranking[1];
  if (secondBid && secondBid.amount === highestBid.amount) {
    // RJ-02: el empate es estructuralmente imposible bajo RS-10 (toda puja
    // debe superar estrictamente la vigente). Si ocurre, es un bug de
    // concurrencia — se aborta el cierre y se escala, nunca se desempata.
    await recordAudit({
      action: "adjudicacion.empate_detectado",
      resource: "vehicle",
      resourceId: vehicleId,
      after: { montoEmpatado: highestBid.amount, bidIds: [highestBid._id, secondBid._id] },
    });
    logger.error("empate detectado al adjudicar — requiere intervención manual", { vehicleId });
    return undefined;
  }

  await Bid.updateMany(
    { vehicleId, _id: { $ne: highestBid._id }, status: { $ne: "paid" } },
    { status: "outbid" }
  );

  const wasAlreadyWinner = highestBid.status === "winner";
  if (highestBid.status !== "paid") {
    highestBid.status = "winner";
    await highestBid.save();

    // La adjudicación (y su plazo de 5 días hábiles) solo se (re)escribe
    // mientras el ganador siga sin pagar. Si el bid ya está paid, esta
    // función es un no-op total sobre Adjudicacion — re-ejecutarla (p.ej.
    // un admin repitiendo el PATCH de estado tras el pago) NO debe reabrir
    // un plazo de pago sobre un vehículo ya vendido, ni exponer al
    // comprador que ya pagó a una inhabilitación por incumplimiento.
    const fechaActo = new Date();
    await Adjudicacion.findOneAndUpdate(
      { vehicleId },
      {
        vehicleId,
        ganadorBidId: highestBid._id,
        segundoBidId: secondBid?._id,
        segundoMonto: secondBid?.amount,
        fechaActo,
        fechaLimitePago: addBusinessDays(fechaActo, DIAS_HABILES_PAGO),
        estado: "ADJUDICADA_PENDIENTE_PAGO",
      },
      { upsert: true, setDefaultsOnInsert: true }
    );

    if (!wasAlreadyWinner) {
      const vehicle = await Vehicle.findById(vehicleId).select("title");
      await notify({
        userId: highestBid.userId,
        type: "won",
        title: "¡Ganaste la subasta!",
        body: `Tu puja fue la más alta por "${vehicle?.title ?? "el vehículo"}". Tienes 5 días hábiles para completar el pago.`,
        data: { vehicleId, bidId: highestBid._id.toString() },
      });
    }
  }
  return highestBid._id.toString();
}

// Cierra todas las subastas activas ya vencidas. Cada vehículo se reclama de
// forma atómica (active→closed), así el job es idempotente y tolerante a
// reinicios o a varias instancias corriendo a la vez: nadie adjudica dos veces.
export async function closeExpiredAuctions(actor?: UserDoc): Promise<number> {
  let closed = 0;

  for (;;) {
    const vehicle = await Vehicle.findOneAndUpdate(
      { status: "active", auctionEndDate: { $lte: new Date() } },
      { status: "closed" },
      { returnDocument: "after" }
    );
    if (!vehicle) break;

    const winnerBidId = await adjudicateVehicle(vehicle._id.toString());
    invalidateCatalog();
    publishPublic({ type: "vehicle.status", payload: { vehicleId: vehicle._id.toString(), status: "closed" } });
    closed += 1;

    await recordAudit({
      actor,
      action: "vehicle.auction.autoclose",
      resource: "vehicle",
      resourceId: vehicle._id.toString(),
      before: { status: "active" },
      after: { status: "closed", ...(winnerBidId ? { winnerBidId } : {}) },
      source: "job",
    });

    logger.info("subasta cerrada automáticamente", {
      vehicleId: vehicle._id.toString(),
      winnerBidId,
    });
  }

  return closed;
}

// Cambia el estado de un vehículo (admin). Si transiciona a closed/awarded,
// reaplica la misma adjudicación que el cierre automático. Auditado con el
// actor real. La comparten PATCH /vehicles/:id/status y la tool MCP
// chocao_set_vehicle_status.
export async function setVehicleStatus(
  actor: UserDoc,
  vehicleId: string,
  status: IVehicle["status"],
  requestId?: string
): Promise<{ vehicle: VehicleDoc; winnerBidId?: string }> {
  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle) throw new NotFoundError("Vehículo no encontrado");

  const previousStatus = vehicle.status;
  vehicle.status = status;
  await vehicle.save();
  invalidateCatalog();
  publishPublic({ type: "vehicle.status", payload: { vehicleId: vehicle._id.toString(), status } });

  let winnerBidId: string | undefined;
  if (status === "closed" || status === "awarded") {
    winnerBidId = await adjudicateVehicle(vehicleId);
  }

  await recordAudit({
    actor,
    action: "vehicle.status.change",
    resource: "vehicle",
    resourceId: vehicle._id.toString(),
    before: { status: previousStatus },
    after: { status, ...(winnerBidId ? { winnerBidId } : {}) },
    requestId,
  });

  return { vehicle, winnerBidId };
}

const CLOSING_SOON_WINDOW_MS = 60 * 60 * 1000; // 1 hora

// Avisa a quienes siguen (watchlist) un vehículo activo que está por cerrar
// dentro de la próxima hora. Idempotente vía claim atómico sobre
// closingSoonNotifiedAt — mismo patrón que closeExpiredAuctions: un tick
// duplicado o varias instancias del job no reenvían el aviso.
export async function notifyClosingSoonWatchers(): Promise<number> {
  const now = new Date();
  const soon = new Date(now.getTime() + CLOSING_SOON_WINDOW_MS);
  const vehicles = await Vehicle.find({
    status: "active",
    auctionEndDate: { $gt: now, $lte: soon },
    closingSoonNotifiedAt: { $exists: false },
  }).select("title");

  let notified = 0;
  for (const vehicle of vehicles) {
    const claimed = await Vehicle.findOneAndUpdate(
      { _id: vehicle._id, closingSoonNotifiedAt: { $exists: false } },
      { closingSoonNotifiedAt: now },
      { returnDocument: "after" }
    );
    if (!claimed) continue;

    const watcherIds = await Watchlist.distinct("userId", { vehicleId: vehicle._id });
    if (watcherIds.length === 0) continue;

    await notifyMany(watcherIds, "watch_closing", () => ({
      title: "Una subasta que sigues está por cerrar",
      body: `"${vehicle.title}" cierra en menos de una hora.`,
      data: { vehicleId: vehicle._id.toString() },
    }));
    notified += watcherIds.length;
  }
  return notified;
}

// Recorre las adjudicaciones vencidas sin pago y aplica la consecuencia de
// RP-04: pérdida de la adjudicación y, la inhabilitación se modela con el
// baneo ya existente en el sistema (User.banned + banReason), no con un
// registro de inhabilitados aparte. Si hay segundo postor, se le ofrece la
// adjudicación (RP-05) en vez de declarar desierto directamente. Cada
// adjudicación vencida se reclama con un claim atómico
// (ADJUDICADA_PENDIENTE_PAGO→INCUMPLIDA), igual que closeExpiredAuctions: un
// tick duplicado o varias instancias del job no procesan la misma dos veces.
export async function procesarIncumplimientos(): Promise<number> {
  let procesados = 0;
  for (;;) {
    const vencida = await Adjudicacion.findOneAndUpdate(
      { estado: "ADJUDICADA_PENDIENTE_PAGO", fechaLimitePago: { $lte: new Date() } },
      { estado: "INCUMPLIDA" },
      { returnDocument: "after" }
    );
    if (!vencida) break;

    const bidGanador = await Bid.findById(vencida.ganadorBidId);
    if (bidGanador) {
      await User.findByIdAndUpdate(bidGanador.userId, {
        banned: true,
        banReason: "INCUMPLIMIENTO_PAGO",
        bannedAt: new Date(),
      });
      await notify({
        userId: bidGanador.userId,
        type: "banned",
        title: "Cuenta suspendida por incumplimiento de pago",
        body: "No completaste el pago dentro del plazo legal de 5 días hábiles y tu cuenta fue suspendida.",
        data: {},
      });
    }

    if (vencida.segundoBidId) {
      vencida.estado = "OFERTA_A_SEGUNDO";
      vencida.ofertaSegundoVenceEn = addBusinessDays(new Date(), SEGUNDO_POSTOR_DIAS_HABILES);
      await vencida.save();
      const segundoBid = await Bid.findById(vencida.segundoBidId);
      if (segundoBid) {
        await notify({
          userId: segundoBid.userId,
          type: "won",
          title: "Se te ofrece la adjudicación como segundo mejor postor",
          body: "El adjudicatario original incumplió el pago. Puedes aceptar la adjudicación por tu oferta.",
          data: { vehicleId: vencida.vehicleId.toString() },
        });
      }
    } else {
      vencida.estado = "DESIERTO_POR_INCUMPLIMIENTO";
      await vencida.save();
    }

    await recordAudit({
      action: "adjudicacion.incumplida",
      resource: "adjudicacion",
      resourceId: vencida._id.toString(),
      after: { estado: vencida.estado },
      source: "job",
    });
    procesados += 1;
  }
  return procesados;
}

// El segundo postor acepta la oferta (RP-05): se convierte en el nuevo
// ganador con su propio plazo de pago de 5 días hábiles.
export async function aceptarOfertaSegundoPostor(adjudicacionId: string, user: UserDoc): Promise<AdjudicacionDoc> {
  const adjudicacion = await Adjudicacion.findById(adjudicacionId);
  if (!adjudicacion) throw new NotFoundError("Adjudicación no encontrada");
  if (adjudicacion.estado !== "OFERTA_A_SEGUNDO") throw new ConflictError("Esta oferta ya no está disponible");
  if (adjudicacion.ofertaSegundoVenceEn && adjudicacion.ofertaSegundoVenceEn < new Date()) {
    adjudicacion.estado = "DESIERTO_POR_INCUMPLIMIENTO";
    await adjudicacion.save();
    throw new ConflictError("La ventana para aceptar la oferta ya venció");
  }
  const segundoBid = await Bid.findById(adjudicacion.segundoBidId);
  if (!segundoBid || segundoBid.userId.toString() !== user._id.toString()) {
    throw new ForbiddenError("Solo el segundo mejor postor puede aceptar esta oferta");
  }

  segundoBid.status = "winner";
  await segundoBid.save();
  const fechaActo = new Date();
  adjudicacion.ganadorBidId = segundoBid._id;
  adjudicacion.segundoBidId = undefined;
  adjudicacion.segundoMonto = undefined;
  adjudicacion.fechaActo = fechaActo;
  adjudicacion.fechaLimitePago = addBusinessDays(fechaActo, DIAS_HABILES_PAGO);
  adjudicacion.estado = "ADJUDICADA_PENDIENTE_PAGO";
  adjudicacion.ofertaSegundoVenceEn = undefined;
  await adjudicacion.save();

  await recordAudit({
    actor: user,
    action: "adjudicacion.segundo_postor_acepto",
    resource: "adjudicacion",
    resourceId: adjudicacion._id.toString(),
    after: { estado: adjudicacion.estado },
  });

  return adjudicacion;
}
