import { ConflictError, NotFoundError } from "../lib/errors";
import { logger } from "../lib/logger";
import { assertOwner } from "../lib/ownership";
import stripe from "../lib/stripe";
import { Bid } from "../models/Bid";
import { Payment, type PaymentDoc } from "../models/Payment";
import type { UserDoc } from "../models/User";
import { Vehicle, type VehicleDoc } from "../models/Vehicle";

// Crea (o reutiliza) la sesión de Stripe Checkout de un bid ganador.
// Idempotencia end-to-end (HU-18):
// - un bid ya pagado rechaza nuevos intentos con 409;
// - si ya existe un pago pendiente para el bid, se reutiliza su sesión en
//   lugar de crear otra (una sola sesión activa por bid);
// - la creación en Stripe usa Idempotency-Key derivada del bid, de modo que
//   los reintentos de red no dupliquen sesiones del lado de Stripe.
export async function createCheckout(user: UserDoc, bidId: string): Promise<{ url: string }> {
  const bid = await Bid.findById(bidId).populate<{ vehicleId: VehicleDoc }>("vehicleId");
  if (!bid) throw new NotFoundError("Puja no encontrada");
  assertOwner(bid.userId, user, "No tienes permisos sobre esta puja");

  if (bid.status === "paid") {
    throw new ConflictError("Esta puja ya fue pagada");
  }

  const existing = await Payment.findOne({ bidId: bid._id, status: "pending" });
  if (existing?.stripeSessionId) {
    const session = await stripe.checkout.sessions.retrieve(existing.stripeSessionId);
    if (session.payment_status === "paid") {
      await confirmCheckoutSession({ id: session.id, payment_status: session.payment_status });
      throw new ConflictError("Esta puja ya fue pagada");
    }
    if (session.url) return { url: session.url };
  }

  const vehicle = bid.vehicleId;

  const session = await stripe.checkout.sessions.create(
    {
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
    },
    // Reintentos de red de ESTA creación no duplican la sesión en Stripe
    { idempotencyKey: `checkout-${bid._id.toString()}-${bid.amount}` }
  );

  if (existing) {
    existing.stripeSessionId = session.id;
    await existing.save();
  } else {
    await Payment.create({
      userId: user._id,
      vehicleId: vehicle._id,
      bidId: bid._id,
      stripeSessionId: session.id,
      amount: bid.amount,
      status: "pending",
    });
  }

  if (!session.url) throw new ConflictError("Stripe no devolvió una URL de pago");
  return { url: session.url };
}

export interface CheckoutSessionLike {
  id: string;
  payment_status: string | null;
}

// Confirma un pago a partir de una sesión de Stripe Checkout. La comparten el
// webhook (fuente principal, asíncrona) y GET /payments/success (fallback por
// redirect). Idempotente: el claim atómico pending→paid garantiza que un
// evento duplicado no repita transiciones.
export async function confirmCheckoutSession(
  session: CheckoutSessionLike
): Promise<{ payment: PaymentDoc | null; transitioned: boolean }> {
  if (session.payment_status !== "paid") {
    return { payment: await Payment.findOne({ stripeSessionId: session.id }), transitioned: false };
  }

  const claimed = await Payment.findOneAndUpdate(
    { stripeSessionId: session.id, status: "pending" },
    { status: "paid" },
    { returnDocument: "after" }
  );

  if (!claimed) {
    // Ya confirmado antes (o sesión desconocida): no repetir efectos.
    return { payment: await Payment.findOne({ stripeSessionId: session.id }), transitioned: false };
  }

  // Bid ganador → paid; vehículo → awarded (sets idempotentes)
  await Bid.findByIdAndUpdate(claimed.bidId, { status: "paid" });
  await Vehicle.findByIdAndUpdate(claimed.vehicleId, { status: "awarded" });

  logger.info("pago confirmado", {
    paymentId: claimed._id.toString(),
    bidId: claimed.bidId.toString(),
    sessionId: session.id,
  });

  return { payment: claimed, transitioned: true };
}
