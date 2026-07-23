import { z } from "zod";

export const syncUserSchema = z.object({
  name: z.string("El nombre es obligatorio").trim().min(1, "El nombre es obligatorio").max(120),
  email: z.string("El email es obligatorio").trim().pipe(z.email("El email no es válido")).pipe(z.string().max(254)),
});

export const patchRoleSchema = z.object({
  role: z.enum(["customer", "admin"], "Rol inválido"),
});

export const patchBanSchema = z.object({
  banned: z.boolean("El estado de baneo debe ser verdadero o falso"),
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

export const listUsersQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(["customer", "admin"]).optional(),
  // z.coerce.boolean() coacciona "false" (string no vacío) a `true` — se usa
  // un enum explícito en su lugar para que el filtro "Activos"/"Baneados"
  // funcione con el query param real ("true"/"false").
  banned: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  from: z.coerce.date("Fecha de inicio inválida").optional(),
  to: z.coerce.date("Fecha de fin inválida").optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
