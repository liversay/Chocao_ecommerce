import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    clerkId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    role: { type: String, enum: ["customer", "admin"], default: "customer" },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

export const User = mongoose.model("User", userSchema);
