import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
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

export const Payment = mongoose.model("Payment", paymentSchema);
