import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAuth } from "../middlewares/auth";
import { validate } from "../schemas/common";
import { idParamSchema } from "../schemas/common";
import { aceptarOfertaSegundoPostor } from "../services/auctions";

const adjudicaciones = new Hono<AppEnv>();

// Self-service (RP-05): el propio segundo mejor postor acepta (o no) la
// oferta que le llega tras el incumplimiento del adjudicatario original. No
// requiere un permiso administrativo — la propia lógica del servicio valida
// que quien llama es el dueño del segundo bid.
adjudicaciones.post("/:id/aceptar-oferta", requireAuth, validate("param", idParamSchema), async (c) => {
  const { id } = c.req.valid("param");
  return c.json(await aceptarOfertaSegundoPostor(id, c.get("user")));
});

export default adjudicaciones;
