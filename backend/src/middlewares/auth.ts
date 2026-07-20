import { verifyToken } from "@clerk/backend";
import type { Context, Next } from "hono";
import { User } from "../models/User";
import type { AppEnv } from "../types";

async function getVerifiedUser(c: Context<AppEnv>) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  try {
    // verifyToken is the standalone function from @clerk/backend (not on clerkClient)
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      authorizedParties: [
        "http://localhost:5173",
        process.env.FRONTEND_URL || "http://localhost:5173",
      ],
    });
    return await User.findOne({ clerkId: payload.sub });
  } catch (err) {
    console.error("[auth] verifyToken error:", err);
    return null;
  }
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
