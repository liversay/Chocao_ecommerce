import mongoose, { type HydratedDocument, Types } from "mongoose";

export interface IPayment {
  userId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  bidId: Types.ObjectId;
  stripeSessionId?: string;
  amount: number;
  status: "pending" | "paid" | "cancelled" | "refunded";
  paidAt?: Date;
  referenciaPago?: string;
  createdAt: Date;
}

export type PaymentDoc = HydratedDocument<IPayment>;

const paymentSchema = new mongoose.Schema<IPayment>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    bidId: { type: mongoose.Schema.Types.ObjectId, ref: "Bid", required: true },
    stripeSessionId: { type: String },
    amount: { type: Number, required: true },
    status: { type: String, enum: ["pending", "paid", "cancelled", "refunded"], default: "pending" },
    paidAt: { type: Date },
    // Traza única del pago ligada a vehículo+adjudicatario (RP-03); no es la
    // sesión de Stripe (esa puede reutilizarse en reintentos) sino la
    // referencia de negocio del acto de pago.
    referenciaPago: { type: String, unique: true, sparse: true },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

export const Payment = mongoose.model<IPayment>("Payment", paymentSchema);
