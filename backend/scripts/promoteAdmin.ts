import mongoose from "mongoose";
import "dotenv/config";
import { User } from "../src/models/User";

// Promueve (o pre-registra) a un usuario como admin por email. Idempotente:
// si el email ya existe, solo actualiza el rol; si no, crea un User "cáscara"
// con ese email y un clerkId placeholder — cuando esa persona inicie sesión
// de verdad, POST /api/users/sync lo encuentra por email (fallback existente
// en la ruta) y le asigna su clerkId real, preservando el rol admin.
export async function promoteAdmin(email: string) {
  const normalized = email.trim().toLowerCase();
  const existing = await User.findOne({ email: normalized });

  if (existing) {
    if (existing.role === "admin") return { email: normalized, action: "sin-cambios" as const };
    existing.role = "admin";
    await existing.save();
    return { email: normalized, action: "actualizado" as const };
  }

  await User.create({
    clerkId: `pending-admin-${normalized}`,
    name: normalized.split("@")[0]!,
    email: normalized,
    role: "admin",
  });
  return { email: normalized, action: "creado" as const };
}

if (import.meta.main) {
  const email = process.argv[2];
  if (!email) throw new Error("uso: bun scripts/promoteAdmin.ts <email>");
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI no está definida");
  await mongoose.connect(uri);
  const result = await promoteAdmin(email);
  console.log(`[promoteAdmin] ${result.email}: ${result.action}`);
  await mongoose.disconnect();
}
