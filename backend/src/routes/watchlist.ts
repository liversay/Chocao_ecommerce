import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAuth } from "../middlewares/auth";
import { validate } from "../schemas/common";
import { vehicleIdParamSchema } from "../schemas/watchlist";
import { publishToUser } from "../services/realtime";
import { addToWatchlist, listWatchlist, removeFromWatchlist } from "../services/watchlist";

const watchlist = new Hono<AppEnv>();

watchlist.get("/", requireAuth, async (c) => {
  return c.json(await listWatchlist(c.get("user")));
});

// Publica en el canal personal para que WatchlistBell se mantenga en sync
// entre pestañas/dispositivos del mismo usuario sin esperar al poll de 30s.
watchlist.post("/:vehicleId", requireAuth, validate("param", vehicleIdParamSchema), async (c) => {
  const user = c.get("user");
  const vehicleId = c.req.valid("param").vehicleId;
  const item = await addToWatchlist(user, vehicleId);
  publishToUser(user._id, { type: "watchlist.updated", payload: { vehicleId, action: "added" } });
  return c.json(item, 201);
});

watchlist.delete("/:vehicleId", requireAuth, validate("param", vehicleIdParamSchema), async (c) => {
  const user = c.get("user");
  const vehicleId = c.req.valid("param").vehicleId;
  await removeFromWatchlist(user, vehicleId);
  publishToUser(user._id, { type: "watchlist.updated", payload: { vehicleId, action: "removed" } });
  return c.json({ removed: true });
});

export default watchlist;
