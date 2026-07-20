import { z } from "zod";
import { defineTool } from "../registry";
import { getMyPurchases } from "../../services/bids";

// chocao_get_my_purchases (HU-52): compras (bids pagados) del usuario dueño
// del token, con referencia del pago — nunca datos de otros compradores.
defineTool({
  name: "chocao_get_my_purchases",
  title: "Mis compras",
  description: "Lista los vehículos pagados (compras) del usuario autenticado, con referencia del pago.",
  scope: "bids:read",
  readOnly: true,
  schema: z.object({}),
  handler: async (_args, auth) => ({ purchases: await getMyPurchases(auth.user) }),
});
