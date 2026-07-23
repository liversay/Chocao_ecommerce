import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAuth, requireAuthAllowBanned } from "../middlewares/auth";
import { idParamSchema, validate } from "../schemas/common";
import { listNotificationsQuerySchema } from "../schemas/notifications";
import { listNotifications, markAllRead, markRead, unreadCount } from "../services/notifications";

const notifications = new Hono<AppEnv>();

// Lectura permitida incluso para usuarios baneados: deben poder ver la
// notificación de su propio baneo (y el resto de su historial). Marcar como
// leídas sigue exigiendo requireAuth normal (bloqueado para baneados).
notifications.get("/", requireAuthAllowBanned, validate("query", listNotificationsQuerySchema), async (c) => {
  const { page, limit } = c.req.valid("query");
  return c.json(await listNotifications(c.get("user"), { page, limit }));
});

notifications.get("/unread-count", requireAuthAllowBanned, async (c) => {
  return c.json({ count: await unreadCount(c.get("user")) });
});

notifications.patch("/read-all", requireAuth, async (c) => {
  return c.json(await markAllRead(c.get("user")));
});

notifications.patch("/:id/read", requireAuth, validate("param", idParamSchema), async (c) => {
  const notification = await markRead(c.get("user"), c.req.valid("param").id);
  return c.json(notification);
});

export default notifications;
