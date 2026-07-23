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

  // Modo E2E (Playwright): el token "e2e:<clerkId>" se acepta como identidad
  // sin ir a Clerk — el mismo atajo que usa el mock de los tests de bun.
  // Jamás activo sin E2E=1 explícito en el entorno del proceso.
  if (process.env.E2E === "1" && authHeader.startsWith("Bearer e2e:")) {
    return { sub: authHeader.slice("Bearer e2e:".length) } as Awaited<
      ReturnType<typeof verifyToken>
    >;
  }

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

const BANNED_MESSAGE = "Tu cuenta ha sido suspendida. Contacta a soporte para más información.";

// Bloqueo total: un usuario baneado no puede hacer NADA autenticado (ni leer
// su perfil, ni pujar, ni pagar) — se rechaza aquí, antes de c.set("user", ...),
// para que ninguna ruta downstream vea al usuario como "logueado".
function rejectIfBanned(c: Context<AppEnv>, user: { banned: boolean }) {
  if (user.banned) return c.json({ error: BANNED_MESSAGE }, 403);
  return null;
}

export async function requireAuth(c: Context<AppEnv>, next: Next) {
  const user = await getVerifiedUser(c);
  if (!user) return c.json({ error: "No autorizado" }, 401);
  const banned = rejectIfBanned(c, user);
  if (banned) return banned;
  c.set("user", user);
  await next();
}

// Variante de requireAuth que NO aplica rejectIfBanned: un usuario baneado
// sigue sin poder pujar, pagar ni escribir nada, pero debe poder enterarse
// de que fue baneado (y ver el resto de sus notificaciones). Úsese solo en
// endpoints de solo-lectura donde eso es intencional (GET de notificaciones).
export async function requireAuthAllowBanned(c: Context<AppEnv>, next: Next) {
  const user = await getVerifiedUser(c);
  if (!user) return c.json({ error: "No autorizado" }, 401);
  c.set("user", user);
  await next();
}

export async function requireAdmin(c: Context<AppEnv>, next: Next) {
  const user = await getVerifiedUser(c);
  if (!user) return c.json({ error: "No autorizado" }, 401);
  const banned = rejectIfBanned(c, user);
  if (banned) return banned;
  if (user.role !== "admin") return c.json({ error: "Acceso restringido: solo administradores" }, 403);
  c.set("user", user);
  await next();
}

// RBAC de grano fino: cada endpoint exige el permiso concreto, no "ser admin".
export function requirePermission(permission: Permission) {
  return async (c: Context<AppEnv>, next: Next) => {
    const user = await getVerifiedUser(c);
    if (!user) return c.json({ error: "No autorizado" }, 401);
    const banned = rejectIfBanned(c, user);
    if (banned) return banned;
    if (!checkPermission(user, permission)) {
      return c.json({ error: `No tienes el permiso requerido (${permission})` }, 403);
    }
    c.set("user", user);
    await next();
  };
}
