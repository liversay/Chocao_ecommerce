import { z } from "zod";
import type { ZodType } from "zod";
import { zValidator as baseValidator } from "@hono/zod-validator";
import { ValidationError } from "../lib/errors";

export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "El identificador no tiene un formato válido");

export const idParamSchema = z.object({ id: objectIdSchema });

// zValidator con el contrato de errores de la app: ante datos inválidos lanza
// ValidationError (400, { error }) con el primer problema en español.
export function validate<Target extends "json" | "param" | "query", Schema extends ZodType>(
  target: Target,
  schema: Schema
) {
  return baseValidator(target, schema, (result) => {
    if (!result.success) {
      const issue = result.error.issues[0];
      const path = issue?.path.join(".");
      const detail = issue ? `${path ? `${path}: ` : ""}${issue.message}` : "Datos inválidos";
      throw new ValidationError(detail);
    }
  });
}
