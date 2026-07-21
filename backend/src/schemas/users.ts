import { z } from "zod";

export const syncUserSchema = z.object({
  name: z.string("El nombre es obligatorio").trim().min(1, "El nombre es obligatorio").max(120),
  email: z.string("El email es obligatorio").trim().pipe(z.email("El email no es válido")).pipe(z.string().max(254)),
});

export const patchRoleSchema = z.object({
  role: z.enum(["customer", "admin"], "Rol inválido"),
});
