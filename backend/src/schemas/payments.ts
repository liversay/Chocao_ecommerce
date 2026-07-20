import { z } from "zod";
import { objectIdSchema } from "./common";

export const createCheckoutSchema = z.object({
  bidId: objectIdSchema,
});

export const checkoutSuccessQuerySchema = z.object({
  session_id: z.string("El identificador de sesión es obligatorio").min(1, "El identificador de sesión es obligatorio").max(255),
});
