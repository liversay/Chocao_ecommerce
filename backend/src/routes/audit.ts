import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { requirePermission } from "../middlewares/auth";
import { validate } from "../schemas/common";
import { AuditLog } from "../models/AuditLog";

const audit = new Hono<AppEnv>();

const listAuditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  resource: z.string().max(60).optional(),
});

// Consulta del registro de auditoría (solo admins autorizados)
audit.get("/", requirePermission("audit:read"), validate("query", listAuditQuerySchema), async (c) => {
  const { page, limit, resource } = c.req.valid("query");
  const filter = resource ? { resource } : {};
  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("actor", "name email role"),
    AuditLog.countDocuments(filter),
  ]);
  return c.json({ items, total, page, pages: Math.ceil(total / limit) });
});

export default audit;
