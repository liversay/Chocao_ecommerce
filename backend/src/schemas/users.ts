import { z } from "zod";

export const syncUserSchema = z.object({
  name: z.string("El nombre es obligatorio").trim().min(1, "El nombre es obligatorio").max(120),
  email: z.string("El email es obligatorio").trim().pipe(z.email("El email no es válido")).pipe(z.string().max(254)),
});

export const patchRoleSchema = z.object({
  role: z.enum(["customer", "admin"], "Rol inválido"),
});

export const updateProfileSchema = z.object({
  phone: z.string().trim().max(30).optional(),
  notificationPrefs: z
    .object({
      outbid: z.boolean().optional(),
      won: z.boolean().optional(),
      payment: z.boolean().optional(),
      watchClosing: z.boolean().optional(),
    })
    .optional(),
});
