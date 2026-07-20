import { z } from "zod";

export const placeBidSchema = z.object({
  amount: z
    .number("El monto debe ser un número válido")
    .positive("El monto debe ser mayor a 0")
    .max(100_000_000, "El monto es demasiado alto"),
});
