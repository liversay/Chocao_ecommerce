import { Hono } from "hono";
import stripe from "../lib/stripe";
import { requireAuth } from "../middlewares/auth";
import { Payment } from "../models/Payment";
import { Bid } from "../models/Bid";
import { Vehicle } from "../models/Vehicle";

const payments = new Hono();

payments.post("/create-checkout-session", requireAuth, async (c) => {
  const user = c.get("user");
  const { bidId } = await c.req.json();

  const bid = await Bid.findById(bidId).populate("vehicleId");
  if (!bid) return c.json({ error: "Puja no encontrada" }, 404);
  if (bid.userId.toString() !== user._id.toString()) {
    return c.json({ error: "No tienes permisos sobre esta puja" }, 403);
  }

  const vehicle = bid.vehicleId as InstanceType<typeof Vehicle>;

  const session = await stripe.checkout.sessions.create({
    // No payment_method_types — Stripe selects dynamically based on buyer location
    customer_email: user.email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: (vehicle as any).title || "Vehicle Auction",
            description: `Subasta gubernamental — ${(vehicle as any).brand} ${(vehicle as any).model} ${(vehicle as any).year}`,
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
      vehicleId: (vehicle as any)._id.toString(),
      vehicleTitle: (vehicle as any).title,
      buyerEmail: user.email,
      buyerName: user.name,
    },
    payment_intent_data: {
      description: `Chocao · ${(vehicle as any).title} · Puja ganadora`,
      metadata: {
        bidId: bid._id.toString(),
        vehicleId: (vehicle as any)._id.toString(),
        buyerEmail: user.email,
      },
    },
  });

  await Payment.create({
    userId: user._id,
    vehicleId: (vehicle as any)._id,
    bidId: bid._id,
    stripeSessionId: session.id,
    amount: bid.amount,
    status: "pending",
  });

  return c.json({ url: session.url });
});

payments.get("/success", requireAuth, async (c) => {
  const { session_id } = c.req.query();
  if (!session_id) return c.json({ error: "El identificador de sesión es obligatorio" }, 400);

  const session = await stripe.checkout.sessions.retrieve(session_id);
  if (session.payment_status === "paid") {
    const payment = await Payment.findOneAndUpdate(
      { stripeSessionId: session_id },
      { status: "paid" },
      { new: true }
    );
    if (payment) {
      // Bid transitions from "winner" → "paid" once the user completes the checkout
      await Bid.findByIdAndUpdate(payment.bidId, { status: "paid" });
      await Vehicle.findByIdAndUpdate(payment.vehicleId, { status: "awarded" });
    }
    return c.json({ success: true, payment });
  }
  return c.json({ success: false, status: session.payment_status });
});

payments.get("/cancel", requireAuth, async (c) => {
  return c.json({ cancelled: true });
});

export default payments;
