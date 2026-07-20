import mongoose, { type HydratedDocument, Types } from "mongoose";

export interface IPayment {
  userId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  bidId: Types.ObjectId;
  stripeSessionId?: string;
  amount: number;
  status: "pending" | "paid" | "cancelled";
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
    status: { type: String, enum: ["pending", "paid", "cancelled"], default: "pending" },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

export const Payment = mongoose.model<IPayment>("Payment", paymentSchema);
