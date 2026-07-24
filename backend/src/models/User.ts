import mongoose, { type HydratedDocument } from "mongoose";

export interface INotificationPrefs {
  outbid: boolean;
  won: boolean;
  payment: boolean;
  watchClosing: boolean;
}

export interface IUser {
  clerkId: string;
  name: string;
  email: string;
  role: "customer" | "admin" | "auditor" | "custodio";
  phone?: string;
  banned: boolean;
  notificationPrefs: INotificationPrefs;
  createdAt: Date;
}

export type UserDoc = HydratedDocument<IUser>;

const notificationPrefsSchema = new mongoose.Schema<INotificationPrefs>(
  {
    outbid: { type: Boolean, default: true },
    won: { type: Boolean, default: true },
    payment: { type: Boolean, default: true },
    watchClosing: { type: Boolean, default: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema<IUser>(
  {
    clerkId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    role: { type: String, enum: ["customer", "admin", "auditor", "custodio"], default: "customer" },
    phone: { type: String },
    banned: { type: Boolean, default: false },
    notificationPrefs: { type: notificationPrefsSchema, default: () => ({}) },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

export const User = mongoose.model<IUser>("User", userSchema);
