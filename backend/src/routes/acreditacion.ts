import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAuth, requirePermission } from "../middlewares/auth";
import { validate } from "../schemas/common";
import {
  guardarBorradorSchema,
  aceptarPliegoSchema,
  revisarAcreditacionParamSchema,
  revisarAcreditacionBodySchema,
  listAcreditacionesQuerySchema,
} from "../schemas/acreditacion";
import {
  guardarBorrador,
  aceptarPliego,
  enviarARevision,
  getMiAcreditacion,
  listAcreditaciones,
  revisarAcreditacion,
} from "../services/acreditacion";

const acreditacion = new Hono<AppEnv>();

acreditacion.get("/me", requireAuth, async (c) => {
  return c.json(await getMiAcreditacion(c.get("user")));
});

acreditacion.post("/", requireAuth, validate("json", guardarBorradorSchema), async (c) => {
  const { documento } = c.req.valid("json");
  return c.json(await guardarBorrador(c.get("user"), documento), 201);
});

acreditacion.patch("/pliego", requireAuth, validate("json", aceptarPliegoSchema), async (c) => {
  return c.json(await aceptarPliego(c.get("user")));
});

acreditacion.post("/enviar", requireAuth, async (c) => {
  return c.json(await enviarARevision(c.get("user")));
});

acreditacion.get(
  "/",
  requirePermission("acreditacion:review"),
  validate("query", listAcreditacionesQuerySchema),
  async (c) => {
    const { estado, page, limit } = c.req.valid("query");
    return c.json(await listAcreditaciones({ estado, page, limit }));
  }
);

acreditacion.patch(
  "/:id/revisar",
  requirePermission("acreditacion:review"),
  validate("param", revisarAcreditacionParamSchema),
  validate("json", revisarAcreditacionBodySchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const { decision, motivoRechazo } = c.req.valid("json");
    return c.json(await revisarAcreditacion(c.get("user"), id, decision, motivoRechazo));
  }
);

export default acreditacion;
