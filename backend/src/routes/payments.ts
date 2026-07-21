import { Hono } from "hono";
import type { AppEnv } from "../types";
import stripe from "../lib/stripe";
import { requireAuth } from "../middlewares/auth";
import { rateLimit } from "../middlewares/rateLimit";
import { UnauthorizedError } from "../lib/errors";
import { assertOwner } from "../lib/ownership";
import { logger } from "../lib/logger";
import { confirmCheckoutSession, createCheckout } from "../services/payments";
import { validate } from "../schemas/common";
import { checkoutSuccessQuerySchema, createCheckoutSchema } from "../schemas/payments";
import { Payment } from "../models/Payment";

const payments = new Hono<AppEnv>();

// Webhook de Stripe (checkout.session.completed). Confirmación asíncrona y
// resistente a fallos: el pago se registra aunque el usuario cierre el
// navegador. SIN requireAuth ni Zod — la autenticidad la da la firma, que se
// valida sobre el cuerpo RAW byte-exacto (nada debe consumir el body antes).
payments.post("/webhook", async (c) => {
  const signature = c.req.header("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    logger.error("STRIPE_WEBHOOK_SECRET no está configurado");
    throw new UnauthorizedError("Webhook no configurado");
  }
  if (!signature) throw new UnauthorizedError("Falta la firma del webhook");

  const rawBody = await c.req.text();
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret);
  } catch {
    throw new UnauthorizedError("Firma del webhook inválida");
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const { transitioned } = await confirmCheckoutSession({
      id: session.id,
      payment_status: session.payment_status,
    });
    logger.info("webhook checkout.session.completed", {
      sessionId: session.id,
      transitioned,
      eventId: event.id,
    });
  }

  // 200 siempre que la firma sea válida: los eventos que no manejamos se
  // reciben y descartan (Stripe no debe reintentarlos).
  return c.json({ received: true });
});

// La lógica (ownership, 409 si ya pagado, reutilización de sesión pendiente,
// Idempotency-Key hacia Stripe) vive en services/payments.createCheckout.
payments.post("/create-checkout-session", requireAuth, rateLimit({ name: "checkout", max: 5 }), validate("json", createCheckoutSchema), async (c) => {
  const result = await createCheckout(c.get("user"), c.req.valid("json").bidId);
  return c.json(result);
});

payments.get("/success", requireAuth, validate("query", checkoutSuccessQuerySchema), async (c) => {
  const { session_id } = c.req.valid("query");

  // Solo el dueño del pago puede confirmarlo/consultarlo (403, no 404 con datos).
  // Este endpoint es el fallback por redirect; la fuente principal de
  // confirmación es el webhook (ambos comparten confirmCheckoutSession).
  const existing = await Payment.findOne({ stripeSessionId: session_id });
  if (existing) assertOwner(existing.userId, c.get("user"), "No tienes permisos sobre este pago");

  const session = await stripe.checkout.sessions.retrieve(session_id);
  if (session.payment_status === "paid") {
    const { payment } = await confirmCheckoutSession({
      id: session.id,
      payment_status: session.payment_status,
    });
    return c.json({ success: true, payment });
  }
  return c.json({ success: false, status: session.payment_status });
});

payments.get("/cancel", requireAuth, async (c) => {
  return c.json({ cancelled: true });
});

export default payments;
