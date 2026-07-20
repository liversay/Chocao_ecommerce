import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAuth, requireAdmin, verifyClerkToken } from "../middlewares/auth";
import { NotFoundError, UnauthorizedError } from "../lib/errors";
import { idParamSchema, validate } from "../schemas/common";
import { patchRoleSchema, syncUserSchema } from "../schemas/users";
import { User } from "../models/User";

const users = new Hono<AppEnv>();

users.get("/me", requireAuth, async (c) => {
  return c.json(c.get("user"));
});

// Sincroniza el usuario de Clerk en Mongo. Exige un token válido de Clerk y
// toma el clerkId del token (nunca del body) para impedir suplantaciones.
users.post("/sync", validate("json", syncUserSchema), async (c) => {
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
  requireAdmin,
  validate("param", idParamSchema),
  validate("json", patchRoleSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const { role } = c.req.valid("json");

    const user = await User.findByIdAndUpdate(id, { role }, { new: true });
    if (!user) throw new NotFoundError("Usuario no encontrado");
    return c.json(user);
  }
);

export default users;
