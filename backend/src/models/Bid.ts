import mongoose from "mongoose";

const bidSchema = new mongoose.Schema(
  {
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ["active", "outbid", "winner", "paid"], default: "active" },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

export const Bid = mongoose.model("Bid", bidSchema);
