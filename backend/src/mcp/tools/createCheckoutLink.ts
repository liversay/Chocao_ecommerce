import { z } from "zod";
import { defineTool } from "../registry";
import { objectIdSchema } from "../../schemas/common";
import { createCheckout } from "../../services/payments";

// chocao_create_checkout_link (HU-53): genera el link de Stripe Checkout de
// una puja ganadora del usuario del token. Reutiliza services/payments
// (ownership, solo bids "winner", idempotencia — HU-18/24). El agente nunca
// ve ni maneja datos de tarjeta, solo entrega la url. Acción de pago:
// requiere confirmación explícita del usuario.
defineTool({
  name: "chocao_create_checkout_link",
  title: "Generar link de pago",
  description:
    "Genera un enlace de Stripe Checkout para pagar una puja ganadora del usuario autenticado. " +
    "Solo procede si el bid pertenece al usuario y está en estado winner. Requiere confirmación " +
    "del usuario antes de invocarse.",
  scope: "payments:write",
  requiresConfirmation: true,
  schema: z.object({ bidId: objectIdSchema }),
  handler: async ({ bidId }, auth) => createCheckout(auth.user, bidId),
});
