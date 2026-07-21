import { ForbiddenError } from "./errors";
import type { UserDoc } from "../models/User";

// Autorización a nivel de recurso: el recurso solo puede operarlo su dueño.
// Responde 403 (nunca 404 con datos) para no filtrar información ajena.
export function assertOwner(
  ownerId: { toString(): string } | string,
  user: UserDoc,
  message = "No tienes permisos sobre este recurso"
) {
  if (ownerId.toString() !== user._id.toString()) {
    throw new ForbiddenError(message);
  }
}
