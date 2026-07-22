import { z } from "zod";

export const reportsQuerySchema = z.object({
  from: z.coerce.date("Fecha de inicio inválida").optional(),
  to: z.coerce.date("Fecha de fin inválida").optional(),
});
