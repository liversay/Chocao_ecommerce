import type { Types } from "mongoose";
import { NotFoundError } from "../lib/errors";
import { logger } from "../lib/logger";
import { sendEmail } from "../lib/mailer";
import { assertOwner } from "../lib/ownership";
import { Notification, type INotification, type INotificationData, type NotificationDoc } from "../models/Notification";
import { User, type INotificationPrefs, type UserDoc } from "../models/User";
import { renderEmail } from "./emails";
import { publishToUser } from "./realtime";

export interface NotifyInput {
  userId: Types.ObjectId | string;
  type: INotification["type"];
  title: string;
  body: string;
  data?: INotificationData;
}

// "banned" no tiene entrada aquí a propósito: es un aviso obligatorio de
// estado de cuenta, no una preferencia que el usuario pueda silenciar.
const PREF_KEY_BY_TYPE: Partial<Record<INotification["type"], keyof INotificationPrefs>> = {
  outbid: "outbid",
  won: "won",
  payment_confirmed: "payment",
  refunded: "payment",
  watch_closing: "watchClosing",
};

// Crea la notificación in-app y dispara el email best-effort, solo si la
// preferencia del usuario para ese tipo está activa. Nunca lanza — igual que
// recordAudit(), un fallo aquí no debe reventar el flujo de negocio que
// disparó el evento (puja, adjudicación, pago, reembolso).
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const user = await User.findById(input.userId);
    if (!user) return;

    const prefKey = PREF_KEY_BY_TYPE[input.type];
    if (prefKey && !user.notificationPrefs[prefKey]) return;

    const notification = await Notification.create({
      userId: user._id,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data ?? {},
    });

    publishToUser(user._id, {
      type: "notification",
      payload: {
        id: notification._id.toString(),
        type: notification.type,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        createdAt: notification.createdAt,
      },
    });

    const { subject, html } = renderEmail(input.title, input.body);
    await sendEmail({ to: user.email, subject, html });
  } catch (err) {
    logger.error("no se pudo notificar", {
      userId: input.userId.toString(),
      type: input.type,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function notifyMany<T extends Types.ObjectId | string>(
  userIds: T[],
  type: INotification["type"],
  factory: (userId: T) => { title: string; body: string; data?: INotificationData }
): Promise<void> {
  await Promise.all(
    userIds.map((userId) => {
      const { title, body, data } = factory(userId);
      return notify({ userId, type, title, body, data });
    })
  );
}

export async function listNotifications(
  user: UserDoc,
  { page = 1, limit = 20 }: { page?: number; limit?: number } = {}
): Promise<{ items: NotificationDoc[]; total: number; page: number; pages: number }> {
  const filter = { userId: user._id };
  const [items, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Notification.countDocuments(filter),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function unreadCount(user: UserDoc): Promise<number> {
  return Notification.countDocuments({ userId: user._id, read: false });
}

export async function markRead(user: UserDoc, id: string): Promise<NotificationDoc> {
  const notification = await Notification.findById(id);
  if (!notification) throw new NotFoundError("Notificación no encontrada");
  assertOwner(notification.userId, user, "No tienes permisos sobre esta notificación");
  notification.read = true;
  await notification.save();
  return notification;
}

export async function markAllRead(user: UserDoc): Promise<{ modified: number }> {
  const result = await Notification.updateMany({ userId: user._id, read: false }, { read: true });
  return { modified: result.modifiedCount };
}
