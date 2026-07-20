import mongoose, { type HydratedDocument, Types } from "mongoose";

export interface IBid {
  vehicleId: Types.ObjectId;
  userId: Types.ObjectId;
  amount: number;
  status: "active" | "outbid" | "winner" | "paid";
  createdAt: Date;
}

export type BidDoc = HydratedDocument<IBid>;

const bidSchema = new mongoose.Schema<IBid>(
  {
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ["active", "outbid", "winner", "paid"], default: "active" },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

export const Bid = mongoose.model<IBid>("Bid", bidSchema);
