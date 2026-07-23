import mongoose, { type HydratedDocument, Types } from "mongoose";

export interface INotificationData {
  vehicleId?: string;
  bidId?: string;
  paymentId?: string;
}

export interface INotification {
  userId: Types.ObjectId;
  type: "outbid" | "won" | "payment_confirmed" | "refunded" | "watch_closing" | "banned";
  title: string;
  body: string;
  data?: INotificationData;
  read: boolean;
  createdAt: Date;
}

export type NotificationDoc = HydratedDocument<INotification>;

const notificationSchema = new mongoose.Schema<INotification>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["outbid", "won", "payment_confirmed", "refunded", "watch_closing", "banned"],
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    read: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });

export const Notification = mongoose.model<INotification>("Notification", notificationSchema);
