import mongoose, { type HydratedDocument } from "mongoose";

export interface IUser {
  clerkId: string;
  name: string;
  email: string;
  role: "customer" | "admin";
  createdAt: Date;
}

export type UserDoc = HydratedDocument<IUser>;

const userSchema = new mongoose.Schema<IUser>(
  {
    clerkId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    role: { type: String, enum: ["customer", "admin"], default: "customer" },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

export const User = mongoose.model<IUser>("User", userSchema);
