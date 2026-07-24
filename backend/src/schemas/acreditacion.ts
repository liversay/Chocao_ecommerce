import { z } from "zod";
import { objectIdSchema } from "./common";

export const guardarBorradorSchema = z.object({
  documento: z.string().min(3, "El documento es requerido"),
});

export const aceptarPliegoSchema = z.object({
  aceptoPliego: z.literal(true, { message: "Debes aceptar el pliego de cargos para continuar" }),
});

export const revisarAcreditacionParamSchema = z.object({ id: objectIdSchema });

export const revisarAcreditacionBodySchema = z
  .object({
    decision: z.enum(["APROBAR", "RECHAZAR"]),
    motivoRechazo: z
      .enum(["DOCUMENTO_INVALIDO", "DOCUMENTO_DUPLICADO", "VERIFICACION_FALLIDA", "OTRO"])
      .optional(),
  })
  .refine((v) => v.decision !== "RECHAZAR" || !!v.motivoRechazo, {
    message: "motivoRechazo es requerido al rechazar",
    path: ["motivoRechazo"],
  });
