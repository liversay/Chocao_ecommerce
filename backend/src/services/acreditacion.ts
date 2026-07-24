import { ConflictError, NotFoundError, ValidationError } from "../lib/errors";
import { normalizarDocumento } from "../lib/identidad";
import { identityProvider } from "../lib/providers/identity";
import { Proponente, type ProponenteDoc, type MotivoRechazo } from "../models/Proponente";
import type { UserDoc } from "../models/User";
import { recordAudit } from "./audit";

// Crea el borrador de acreditación del usuario o actualiza su documento
// mientras siga en BORRADOR o RECHAZADO (RA-10: corrección permitida antes
// de enviar a revisión). Valida formato (RI-01) y unicidad canónica (RI-03).
export async function guardarBorrador(user: UserDoc, documentoRaw: string): Promise<ProponenteDoc> {
  const normalizado = normalizarDocumento(documentoRaw);
  if (!normalizado) throw new ValidationError("El documento no tiene un formato reconocido");

  const existenteAjeno = await Proponente.findOne({
    "documento.canonico": normalizado.canonico,
    userId: { $ne: user._id },
  });
  if (existenteAjeno) throw new ConflictError("Este documento ya está registrado por otro usuario");

  let proponente = await Proponente.findOne({ userId: user._id });
  if (proponente && !["BORRADOR", "RECHAZADO"].includes(proponente.estado)) {
    throw new ConflictError("Tu acreditación ya no admite cambios de documento");
  }

  if (proponente) {
    proponente.documento = { canonico: normalizado.canonico, original: documentoRaw, categoria: normalizado.categoria };
    proponente.estado = "BORRADOR";
    proponente.motivoRechazo = undefined;
    await proponente.save();
  } else {
    proponente = await Proponente.create({
      userId: user._id,
      documento: { canonico: normalizado.canonico, original: documentoRaw, categoria: normalizado.categoria },
    });
  }
  return proponente;
}

// Registra la aceptación del pliego de cargos (RA-03/RB-04), con timestamp.
export async function aceptarPliego(user: UserDoc): Promise<ProponenteDoc> {
  const proponente = await Proponente.findOne({ userId: user._id });
  if (!proponente) throw new NotFoundError("Aún no iniciaste tu acreditación");
  proponente.aceptoPliego = true;
  proponente.aceptoPliegoEn = new Date();
  await proponente.save();
  return proponente;
}

// Envía la acreditación a revisión: corre la verificación (mock) y, si la
// aprueba, marca ACREDITADO directamente (verificación automática); si la
// rechaza, queda RECHAZADA con motivo tipificado (RA-10).
export async function enviarARevision(user: UserDoc): Promise<ProponenteDoc> {
  const proponente = await Proponente.findOne({ userId: user._id });
  if (!proponente) throw new NotFoundError("Aún no iniciaste tu acreditación");
  if (!proponente.aceptoPliego) throw new ValidationError("Debes aceptar el pliego de cargos antes de continuar");
  if (proponente.estado === "ACREDITADO") return proponente;

  const resultado = await identityProvider.verify({ documentoCanonico: proponente.documento.canonico });
  proponente.verificacion = { estado: resultado.estado, verificadoEn: new Date() };
  proponente.estado = resultado.estado === "APROBADO" ? "ACREDITADO" : "RECHAZADO";
  if (resultado.estado === "RECHAZADO") proponente.motivoRechazo = "VERIFICACION_FALLIDA";
  await proponente.save();

  await recordAudit({
    actor: user,
    action: proponente.estado === "ACREDITADO" ? "acreditacion.aprobada" : "acreditacion.rechazada",
    resource: "proponente",
    resourceId: proponente._id.toString(),
    after: { estado: proponente.estado, motivoRechazo: proponente.motivoRechazo },
  });

  return proponente;
}

export async function getMiAcreditacion(user: UserDoc): Promise<ProponenteDoc | null> {
  return Proponente.findOne({ userId: user._id });
}

// Usado por el gate de puja (Task 5): true solo si ACREDITADO.
export async function estaAcreditado(userId: string): Promise<boolean> {
  const proponente = await Proponente.findOne({ userId, estado: "ACREDITADO" });
  return !!proponente;
}

export interface ListAcreditacionesParams {
  estado?: string;
  page?: number;
  limit?: number;
}

export async function listAcreditaciones({ estado, page = 1, limit = 20 }: ListAcreditacionesParams) {
  const filter: Record<string, unknown> = {};
  if (estado) filter.estado = estado;
  const [items, total] = await Promise.all([
    Proponente.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("userId", "name email"),
    Proponente.countDocuments(filter),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

// Aprobación/rechazo manual por un revisor (permiso acreditacion:review).
// Complementa la verificación automática de enviarARevision para los casos
// EN_REVISION que requieran juicio humano, o para revertir un RECHAZADO.
export async function revisarAcreditacion(
  actor: UserDoc,
  proponenteId: string,
  decision: "APROBAR" | "RECHAZAR",
  motivoRechazo?: MotivoRechazo
): Promise<ProponenteDoc> {
  const proponente = await Proponente.findById(proponenteId);
  if (!proponente) throw new NotFoundError("Proponente no encontrado");

  const estadoAnterior = proponente.estado;
  proponente.estado = decision === "APROBAR" ? "ACREDITADO" : "RECHAZADO";
  proponente.motivoRechazo = decision === "RECHAZAR" ? motivoRechazo : undefined;
  await proponente.save();

  await recordAudit({
    actor,
    action: "acreditacion.revisada",
    resource: "proponente",
    resourceId: proponente._id.toString(),
    before: { estado: estadoAnterior },
    after: { estado: proponente.estado, motivoRechazo: proponente.motivoRechazo },
  });

  return proponente;
}
