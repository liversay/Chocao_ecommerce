import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { requireAuth, requirePermission } from "../middlewares/auth";
import { objectIdSchema, validate } from "../schemas/common";
import {
  entregaIdParamSchema,
  registrarChecklistItemSchema,
  registrarInventarioSchema,
  registrarVinSchema,
} from "../schemas/entrega";
import {
  generarActa,
  getEntrega,
  iniciarEntrega,
  registrarChecklistItem,
  registrarInventario,
  registrarVin,
} from "../services/entrega";

const entrega = new Hono<AppEnv>();

const iniciarEntregaSchema = z.object({ paymentId: objectIdSchema, depositoId: objectIdSchema, slotId: objectIdSchema });

entrega.post("/", requireAuth, validate("json", iniciarEntregaSchema), async (c) => {
  const { paymentId, depositoId, slotId } = c.req.valid("json");
  return c.json(await iniciarEntrega(paymentId, depositoId, slotId, c.get("user")), 201);
});

entrega.get("/:id", requireAuth, validate("param", entregaIdParamSchema), async (c) => {
  return c.json(await getEntrega(c.req.valid("param").id, c.get("user")));
});

entrega.post(
  "/:id/checklist",
  requirePermission("entrega:execute"),
  validate("param", entregaIdParamSchema),
  validate("json", registrarChecklistItemSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const { clave, fotoUrl, geolocalizacion } = c.req.valid("json");
    return c.json(await registrarChecklistItem(id, clave, fotoUrl, geolocalizacion));
  }
);

entrega.post(
  "/:id/vin",
  requirePermission("entrega:execute"),
  validate("param", entregaIdParamSchema),
  validate("json", registrarVinSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const { vin } = c.req.valid("json");
    return c.json(await registrarVin(id, vin));
  }
);

entrega.post(
  "/:id/inventario",
  requirePermission("entrega:execute"),
  validate("param", entregaIdParamSchema),
  validate("json", registrarInventarioSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const { items } = c.req.valid("json");
    return c.json(await registrarInventario(id, items));
  }
);

entrega.post("/:id/acta", requirePermission("entrega:execute"), validate("param", entregaIdParamSchema), async (c) => {
  const { id } = c.req.valid("param");
  return c.json(await generarActa(id, c.get("user")));
});

export default entrega;
