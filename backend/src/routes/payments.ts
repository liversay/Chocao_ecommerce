import { Hono } from "hono";
import type { AppEnv } from "../types";
import stripe from "../lib/stripe";
import { requireAuth } from "../middlewares/auth";
import { rateLimit } from "../middlewares/rateLimit";
import { NotFoundError, UnauthorizedError } from "../lib/errors";
import { assertOwner } from "../lib/ownership";
import { logger } from "../lib/logger";
import { confirmCheckoutSession } from "../services/payments";
import { validate } from "../schemas/common";
import { checkoutSuccessQuerySchema, createCheckoutSchema } from "../schemas/payments";
import { Payment } from "../models/Payment";
import { Bid } from "../models/Bid";
import type { VehicleDoc } from "../models/Vehicle";

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

payments.post("/create-checkout-session", requireAuth, rateLimit({ name: "checkout", max: 5 }), validate("json", createCheckoutSchema), async (c) => {
  const user = c.get("user");
  const { bidId } = c.req.valid("json");

  const bid = await Bid.findById(bidId).populate<{ vehicleId: VehicleDoc }>("vehicleId");
  if (!bid) throw new NotFoundError("Puja no encontrada");
  assertOwner(bid.userId, user, "No tienes permisos sobre esta puja");

  const vehicle = bid.vehicleId;

  const session = await stripe.checkout.sessions.create({
    // No payment_method_types — Stripe selects dynamically based on buyer location
    customer_email: user.email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: vehicle.title || "Vehicle Auction",
            description: `Subasta gubernamental — ${vehicle.brand} ${vehicle.model} ${vehicle.year}`,
          },
          unit_amount: Math.round(bid.amount * 100),
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${process.env.STRIPE_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: process.env.STRIPE_CANCEL_URL,
    metadata: {
      bidId: bid._id.toString(),
      userId: user._id.toString(),
      vehicleId: vehicle._id.toString(),
      vehicleTitle: vehicle.title,
      buyerEmail: user.email,
      buyerName: user.name,
    },
    payment_intent_data: {
      description: `Chocao · ${vehicle.title} · Puja ganadora`,
      metadata: {
        bidId: bid._id.toString(),
        vehicleId: vehicle._id.toString(),
        buyerEmail: user.email,
      },
    },
  });

  await Payment.create({
    userId: user._id,
    vehicleId: vehicle._id,
    bidId: bid._id,
    stripeSessionId: session.id,
    amount: bid.amount,
    status: "pending",
  });

  return c.json({ url: session.url });
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
