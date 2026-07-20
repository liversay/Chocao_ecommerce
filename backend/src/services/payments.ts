import { logger } from "../lib/logger";
import { Bid } from "../models/Bid";
import { Payment, type PaymentDoc } from "../models/Payment";
import { Vehicle } from "../models/Vehicle";

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
