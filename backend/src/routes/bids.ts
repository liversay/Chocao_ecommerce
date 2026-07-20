import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAuth, requirePermission } from "../middlewares/auth";
import { rateLimit } from "../middlewares/rateLimit";
import { idParamSchema, validate } from "../schemas/common";
import { placeBidSchema } from "../schemas/bids";
import { placeBid } from "../services/bids";
import { Bid } from "../models/Bid";

const bids = new Hono<AppEnv>();

// Admin: all bids
bids.get("/", requirePermission("report:read"), async (c) => {
  const list = await Bid.find().populate("vehicleId userId").sort({ createdAt: -1 });
  return c.json(list);
});

// Customer: my bids
bids.get("/my", requireAuth, async (c) => {
  const user = c.get("user");
  const list = await Bid.find({ userId: user._id })
    .populate("vehicleId")
    .sort({ createdAt: -1 });
  return c.json(list);
});

// Customer: my purchases (paid bids only)
bids.get("/my/purchases", requireAuth, async (c) => {
  const user = c.get("user");
  const list = await Bid.find({ userId: user._id, status: "paid" })
    .populate("vehicleId")
    .sort({ createdAt: -1 });
  return c.json(list);
});

// Bids for a vehicle
bids.get("/vehicle/:id", validate("param", idParamSchema), async (c) => {
  const list = await Bid.find({ vehicleId: c.req.valid("param").id })
    .populate("userId", "name email")
    .sort({ amount: -1 });
  return c.json(list);
});

// Place a bid — la regla de negocio y el control de concurrencia viven en
// services/bids.placeBid
bids.post(
  "/vehicle/:id",
  requireAuth,
  // tras requireAuth el límite es por usuario, no por IP
  rateLimit({ name: "place-bid", max: 15 }),
  validate("param", idParamSchema),
  validate("json", placeBidSchema),
  async (c) => {
    const { bid } = await placeBid(c.get("user"), c.req.valid("param").id, c.req.valid("json").amount);
    return c.json(bid, 201);
  }
);

export default bids;
