import mongoose, { type HydratedDocument, Types } from "mongoose";

export interface IVehicle {
  title: string;
  brand: string;
  model: string;
  year: number;
  color?: string;
  mileage?: number;
  condition: "excellent" | "good" | "fair" | "poor";
  description?: string;
  images: string[];
  basePrice: number;
  currentPrice: number;
  status: "draft" | "published" | "active" | "closed" | "awarded";
  auctionStartDate?: Date;
  auctionEndDate?: Date;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type VehicleDoc = HydratedDocument<IVehicle>;

const vehicleSchema = new mongoose.Schema<IVehicle>(
  {
    title: { type: String, required: true },
    brand: { type: String, required: true },
    model: { type: String, required: true },
    year: { type: Number, required: true },
    color: { type: String },
    mileage: { type: Number },
    condition: { type: String, enum: ["excellent", "good", "fair", "poor"], default: "good" },
    description: { type: String },
    images: [{ type: String }],
    basePrice: { type: Number, required: true },
    currentPrice: { type: Number, required: true },
    status: {
      type: String,
      enum: ["draft", "published", "active", "closed", "awarded"],
      default: "draft",
    },
    auctionStartDate: { type: Date },
    auctionEndDate: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const Vehicle = mongoose.model<IVehicle>("Vehicle", vehicleSchema);
