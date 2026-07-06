import { Hono } from "hono";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { User } from "../models/User";

const users = new Hono();

users.get("/me", requireAuth, async (c) => {
  return c.json(c.get("user"));
});

users.post("/sync", async (c) => {
  const body = await c.req.json();
  const { clerkId, name, email } = body;

  if (!clerkId || !name || !email) {
    return c.json({ error: "Los campos clerkId, nombre y email son obligatorios" }, 400);
  }

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

users.patch("/:id/role", requireAdmin, async (c) => {
  const { id } = c.req.param();
  const { role } = await c.req.json();

  if (!["customer", "admin"].includes(role)) {
    return c.json({ error: "Rol inválido" }, 400);
  }

  const user = await User.findByIdAndUpdate(id, { role }, { new: true });
  if (!user) return c.json({ error: "Usuario no encontrado" }, 404);
  return c.json(user);
});

export default users;
