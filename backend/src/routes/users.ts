import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAuth, requirePermission, verifyClerkToken } from "../middlewares/auth";
import { rateLimit } from "../middlewares/rateLimit";
import { NotFoundError, UnauthorizedError, ValidationError } from "../lib/errors";
import { idParamSchema, validate } from "../schemas/common";
import { listUsersQuerySchema, patchBanSchema, patchRoleSchema, syncUserSchema, updateProfileSchema } from "../schemas/users";
import { recordAudit } from "../services/audit";
import { notify } from "../services/notifications";
import { publishToAdmins } from "../services/realtime";
import { listUsers } from "../services/users";
import { User } from "../models/User";

const users = new Hono<AppEnv>();

users.get("/me", requireAuth, async (c) => {
  return c.json(c.get("user"));
});

users.get("/", requirePermission("users:read"), validate("query", listUsersQuerySchema), async (c) => {
  return c.json(await listUsers(c.req.valid("query")));
});

users.patch("/me", requireAuth, validate("json", updateProfileSchema), async (c) => {
  const user = c.get("user");
  const { phone, notificationPrefs } = c.req.valid("json");
  if (phone !== undefined) user.phone = phone;
  if (notificationPrefs) Object.assign(user.notificationPrefs, notificationPrefs);
  await user.save();
  return c.json(user);
});

// Sincroniza el usuario de Clerk en Mongo. Exige un token válido de Clerk y
// toma el clerkId del token (nunca del body) para impedir suplantaciones.
users.post("/sync", rateLimit({ name: "sync", max: 20 }), validate("json", syncUserSchema), async (c) => {
  const payload = await verifyClerkToken(c);
  if (!payload) throw new UnauthorizedError();

  const clerkId = payload.sub;
  const { name, email } = c.req.valid("json");

  // Find by clerkId first, then by email (to preserve role when clerkId updates)
  let existing = await User.findOne({ clerkId });
  if (!existing) existing = await User.findOne({ email });

  if (existing) {
    if (existing.clerkId !== clerkId) {
      existing.clerkId = clerkId;
      await existing.save();
    }
    return c.json(existing);
  }

  const user = await User.create({ clerkId, name, email, role: "customer" });
  return c.json(user, 201);
});

users.patch(
  "/:id/role",
  requirePermission("users:manage"),
  validate("param", idParamSchema),
  validate("json", patchRoleSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const { role } = c.req.valid("json");

    const user = await User.findById(id);
    if (!user) throw new NotFoundError("Usuario no encontrado");

    const previousRole = user.role;
    user.role = role;
    await user.save();

    await recordAudit({
      actor: c.get("user"),
      action: "user.role.change",
      resource: "user",
      resourceId: user._id.toString(),
      before: { role: previousRole },
      after: { role },
      requestId: c.get("requestId"),
    });

    publishToAdmins({ type: "user.updated", payload: { userId: user._id.toString() } });

    return c.json(user);
  }
);

users.patch(
  "/:id/ban",
  requirePermission("users:manage"),
  validate("param", idParamSchema),
  validate("json", patchBanSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const { banned } = c.req.valid("json");
    const actor = c.get("user");

    if (id === actor._id.toString()) {
      throw new ValidationError("No puedes banear tu propia cuenta");
    }

    const user = await User.findById(id);
    if (!user) throw new NotFoundError("Usuario no encontrado");

    const wasBanned = user.banned;
    user.banned = banned;
    await user.save();

    await recordAudit({
      actor,
      action: banned ? "user.ban" : "user.unban",
      resource: "user",
      resourceId: user._id.toString(),
      before: { banned: wasBanned },
      after: { banned },
      requestId: c.get("requestId"),
    });

    publishToAdmins({ type: "user.updated", payload: { userId: user._id.toString() } });

    if (banned && !wasBanned) {
      await notify({
        userId: user._id,
        type: "banned",
        title: "Tu cuenta ha sido suspendida",
        body: "Un administrador suspendió tu cuenta. No podrás pujar, comprar ni acceder a la plataforma mientras la suspensión esté activa.",
      });
    }

    return c.json(user);
  }
);

export default users;
