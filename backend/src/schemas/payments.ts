import { z } from "zod";
import { objectIdSchema } from "./common";

export const createCheckoutSchema = z.object({
  bidId: objectIdSchema,
});

export const checkoutSuccessQuerySchema = z.object({
  session_id: z.string("El identificador de sesión es obligatorio").min(1, "El identificador de sesión es obligatorio").max(255),
});

export const listPaymentsQuerySchema = z.object({
  status: z.enum(["pending", "paid", "cancelled", "refunded"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
