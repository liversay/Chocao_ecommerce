import { z } from "zod";
import { defineTool } from "../registry";
import { getMyBids } from "../../services/bids";

// chocao_get_my_bids (HU-51): lista las pujas del usuario dueño del token
// (nunca de otro), con el vehículo asociado y aviso de pago pendiente.
defineTool({
  name: "chocao_get_my_bids",
  title: "Mis pujas",
  description:
    "Lista las pujas del usuario autenticado con su estado (activa/superada/ganadora/pagada) y " +
    "señala cuáles requieren pago pendiente.",
  scope: "bids:read",
  readOnly: true,
  schema: z.object({}),
  handler: async (_args, auth) => ({ bids: await getMyBids(auth.user) }),
});
