import { verifyToken } from "@clerk/backend";
import type { Context, Next } from "hono";
import { checkPermission, type Permission } from "../lib/permissions";
import { User } from "../models/User";
import type { AppEnv } from "../types";

// Valida el JWT de Clerk y devuelve su payload (o null). No exige que el
// usuario exista aún en Mongo — /users/sync lo usa para el primer login.
export async function verifyClerkToken(c: Context<AppEnv>) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  try {
    // verifyToken is the standalone function from @clerk/backend (not on clerkClient)
    return await verifyToken(authHeader.slice(7), {
      secretKey: process.env.CLERK_SECRET_KEY,
      authorizedParties: [
        "http://localhost:5173",
        process.env.FRONTEND_URL || "http://localhost:5173",
      ],
    });
  } catch (err) {
    console.error("[auth] verifyToken error:", err);
    return null;
  }
}

async function getVerifiedUser(c: Context<AppEnv>) {
  const payload = await verifyClerkToken(c);
  if (!payload) return null;
  return await User.findOne({ clerkId: payload.sub });
}

export async function requireAuth(c: Context<AppEnv>, next: Next) {
  const user = await getVerifiedUser(c);
  if (!user) return c.json({ error: "No autorizado" }, 401);
  c.set("user", user);
  await next();
}

export async function requireAdmin(c: Context<AppEnv>, next: Next) {
  const user = await getVerifiedUser(c);
  if (!user) return c.json({ error: "No autorizado" }, 401);
  if (user.role !== "admin") return c.json({ error: "Acceso restringido: solo administradores" }, 403);
  c.set("user", user);
  await next();
}

// RBAC de grano fino: cada endpoint exige el permiso concreto, no "ser admin".
export function requirePermission(permission: Permission) {
  return async (c: Context<AppEnv>, next: Next) => {
    const user = await getVerifiedUser(c);
    if (!user) return c.json({ error: "No autorizado" }, 401);
    if (!checkPermission(user, permission)) {
      return c.json({ error: `No tienes el permiso requerido (${permission})` }, 403);
    }
    c.set("user", user);
    await next();
  };
}
