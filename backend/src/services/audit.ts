import { AuditLog, type IAuditLog } from "../models/AuditLog";
import { logger } from "../lib/logger";
import type { UserDoc } from "../models/User";

export interface AuditEntry {
  // Sin actor = acción del sistema (jobs)
  actor?: UserDoc;
  action: string;
  resource: string;
  resourceId?: string;
  before?: unknown;
  after?: unknown;
  requestId?: string;
  source?: IAuditLog["source"];
}

// Registra una acción sensible en el log de auditoría (solo-anexado).
// Un fallo al auditar no revienta la operación de negocio, pero queda en
// los logs de error para investigarlo.
export async function recordAudit(entry: AuditEntry) {
  try {
    await AuditLog.create({
      actor: entry.actor?._id,
      actorEmail: entry.actor?.email ?? "sistema",
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      before: entry.before,
      after: entry.after,
      requestId: entry.requestId,
      source: entry.source ?? "api",
    });
  } catch (err) {
    logger.error("no se pudo escribir la auditoría", {
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
