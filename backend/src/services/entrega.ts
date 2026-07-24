import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../lib/errors";
import { Adjudicacion } from "../models/Adjudicacion";
import { Entrega, type EntregaDoc } from "../models/Entrega";
import { Payment } from "../models/Payment";
import { User, type UserDoc } from "../models/User";
import { Vehicle } from "../models/Vehicle";
import { recordAudit } from "./audit";
import { generarContratoHtml } from "./contrato";
import { notify } from "./notifications";
import { CHECKLIST_CLAVES } from "../schemas/entrega";

// Precondiciones de RE-01: pago conciliado y adjudicatario no inhabilitado
// (baneo) sobrevenidamente. El contrato se genera en este mismo paso (RE-02).
export async function iniciarEntrega(
  paymentId: string,
  depositoId: string,
  slotId: string,
  caller: UserDoc
): Promise<EntregaDoc> {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw new NotFoundError("Pago no encontrado");
  if (payment.userId.toString() !== caller._id.toString() && caller.role !== "admin") {
    throw new ForbiddenError("No tienes permisos para iniciar la entrega de este pago");
  }
  if (payment.status !== "paid") throw new ConflictError("La entrega requiere un pago conciliado");

  const comprador = await User.findById(payment.userId);
  if (!comprador || comprador.banned) throw new ForbiddenError("El adjudicatario no puede recibir la entrega");

  const adjudicacion = await Adjudicacion.findOne({ vehicleId: payment.vehicleId });
  if (!adjudicacion) throw new NotFoundError("No se encontró la adjudicación de este pago");

  // Idempotencia: reintentar "iniciar" sobre una entrega ya creada para esta
  // adjudicación devuelve la existente en lugar de violar el índice único de
  // Entrega.adjudicacionId.
  const existente = await Entrega.findOne({ adjudicacionId: adjudicacion._id });
  if (existente) return existente;

  const vehicle = await Vehicle.findById(payment.vehicleId);
  if (!vehicle) throw new NotFoundError("Vehículo no encontrado");

  const { hash } = generarContratoHtml({
    vehicleTitle: vehicle.title,
    vin: vehicle.vin,
    precio: payment.amount,
    adjudicatarioNombre: comprador.name,
    fecha: new Date(),
  });

  const entrega = await Entrega.create({
    adjudicacionId: adjudicacion._id,
    vehicleId: vehicle._id,
    paymentId: payment._id,
    compradorId: comprador._id,
    depositoId,
    citaProgramadaEn: new Date(), // el slot exacto se resuelve contra Deposito.slots en una iteración posterior
    estado: "CITA_AGENDADA",
    checklist: [],
    inventario: [],
    actaHash: hash,
  });

  await recordAudit({
    action: "entrega.iniciada",
    resource: "entrega",
    resourceId: entrega._id.toString(),
    after: { estado: entrega.estado, vehicleId: vehicle._id.toString() },
  });

  return entrega;
}

function assertNoIrreversible(entrega: EntregaDoc) {
  if (entrega.estado === "ENTREGADA") {
    throw new ConflictError("Esta entrega ya fue completada y no admite cambios (RE-08)");
  }
  if (entrega.estado === "BLOQUEADA") {
    throw new ConflictError("Esta entrega está bloqueada por discrepancia de VIN; requiere intervención de un administrador");
  }
}

// Checklist bloqueante (RE-04): no se puede avanzar con ítems pendientes.
export async function registrarChecklistItem(
  entregaId: string,
  clave: string,
  fotoUrl: string,
  geolocalizacion?: { lat: number; lng: number }
): Promise<EntregaDoc> {
  const entrega = await Entrega.findById(entregaId);
  if (!entrega) throw new NotFoundError("Entrega no encontrada");
  assertNoIrreversible(entrega);

  entrega.checklist = entrega.checklist.filter((c) => c.clave !== clave);
  entrega.checklist.push({ clave, fotoUrl, capturadoEn: new Date(), geolocalizacion });
  if (entrega.estado === "CITA_AGENDADA") entrega.estado = "EN_INSPECCION";
  await entrega.save();

  await recordAudit({
    action: "entrega.checklist_item",
    resource: "entrega",
    resourceId: entrega._id.toString(),
    after: { clave },
  });

  return entrega;
}

export function checklistCompleto(entrega: EntregaDoc): boolean {
  const claves = new Set(entrega.checklist.map((c) => c.clave));
  return CHECKLIST_CLAVES.every((c) => claves.has(c));
}

// Validación cruzada de VIN (RE-06): discrepancia bloquea automáticamente y
// escala a un administrador. No es omitible por ningún rol.
export async function registrarVin(entregaId: string, vinCapturado: string): Promise<EntregaDoc> {
  const entrega = await Entrega.findById(entregaId);
  if (!entrega) throw new NotFoundError("Entrega no encontrada");
  assertNoIrreversible(entrega);

  const vehicle = await Vehicle.findById(entrega.vehicleId);
  entrega.vinCapturado = vinCapturado;

  if (vehicle?.vin && vehicle.vin.toUpperCase() !== vinCapturado.toUpperCase()) {
    entrega.estado = "BLOQUEADA";
    entrega.motivoBloqueo = "Discrepancia de VIN entre el registro y la inspección";
    await entrega.save();
    await recordAudit({
      action: "entrega.bloqueada_vin",
      resource: "entrega",
      resourceId: entrega._id.toString(),
      after: { vinRegistrado: vehicle.vin, vinCapturado },
    });
    throw new ConflictError("El VIN capturado no coincide con el registrado; la entrega quedó bloqueada y escalada");
  }

  await entrega.save();
  await recordAudit({
    action: "entrega.vin_validado",
    resource: "entrega",
    resourceId: entrega._id.toString(),
    after: { vinCapturado },
  });
  return entrega;
}

export async function registrarInventario(
  entregaId: string,
  items: { item: string; cantidad: number; faltante: boolean }[]
): Promise<EntregaDoc> {
  const entrega = await Entrega.findById(entregaId);
  if (!entrega) throw new NotFoundError("Entrega no encontrada");
  assertNoIrreversible(entrega);
  entrega.inventario = items;
  await entrega.save();
  await recordAudit({
    action: "entrega.inventario_registrado",
    resource: "entrega",
    resourceId: entrega._id.toString(),
    after: { items },
  });
  return entrega;
}

// Acta de entrega (RE-07): exige checklist completo y VIN validado antes de
// cerrar. Irreversible (RE-08) desde este punto.
export async function generarActa(entregaId: string, custodio: UserDoc): Promise<EntregaDoc> {
  const entrega = await Entrega.findById(entregaId);
  if (!entrega) throw new NotFoundError("Entrega no encontrada");
  assertNoIrreversible(entrega);
  if (!checklistCompleto(entrega)) {
    throw new ValidationError("El checklist de inspección tiene ítems pendientes");
  }
  if (!entrega.vinCapturado) {
    throw new ValidationError("Falta capturar y validar el VIN antes de generar el acta");
  }

  entrega.estado = "ENTREGADA";
  entrega.custodioId = custodio._id;
  entrega.actaGeneradaEn = new Date();
  await entrega.save();

  await recordAudit({
    actor: custodio,
    action: "entrega.completada",
    resource: "entrega",
    resourceId: entrega._id.toString(),
    after: { estado: entrega.estado },
  });

  await notify({
    userId: entrega.compradorId,
    type: "payment_confirmed", // reutiliza un tipo de notificación existente; no se agrega un tipo nuevo en este alcance
    title: "Entrega completada",
    body: "Tu vehículo fue entregado y el acta quedó registrada.",
    data: { vehicleId: entrega.vehicleId.toString() },
  });

  return entrega;
}

export async function getEntrega(entregaId: string, user: UserDoc): Promise<EntregaDoc> {
  const entrega = await Entrega.findById(entregaId);
  if (!entrega) throw new NotFoundError("Entrega no encontrada");
  if (entrega.compradorId.toString() !== user._id.toString() && user.role !== "admin" && user.role !== "custodio") {
    throw new ForbiddenError("No tienes permisos sobre esta entrega");
  }
  return entrega;
}
