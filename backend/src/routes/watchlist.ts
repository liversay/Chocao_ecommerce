import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAuth } from "../middlewares/auth";
import { validate } from "../schemas/common";
import { vehicleIdParamSchema } from "../schemas/watchlist";
import { addToWatchlist, listWatchlist, removeFromWatchlist } from "../services/watchlist";

const watchlist = new Hono<AppEnv>();

watchlist.get("/", requireAuth, async (c) => {
  return c.json(await listWatchlist(c.get("user")));
});

watchlist.post("/:vehicleId", requireAuth, validate("param", vehicleIdParamSchema), async (c) => {
  const item = await addToWatchlist(c.get("user"), c.req.valid("param").vehicleId);
  return c.json(item, 201);
});

watchlist.delete("/:vehicleId", requireAuth, validate("param", vehicleIdParamSchema), async (c) => {
  await removeFromWatchlist(c.get("user"), c.req.valid("param").vehicleId);
  return c.json({ removed: true });
});

export default watchlist;
