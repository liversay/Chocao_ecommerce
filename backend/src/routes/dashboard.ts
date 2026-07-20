import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAdmin } from "../middlewares/auth";
import { Vehicle } from "../models/Vehicle";
import { Bid } from "../models/Bid";
import { User } from "../models/User";
import { Payment } from "../models/Payment";

const dashboard = new Hono<AppEnv>();

dashboard.get("/summary", requireAdmin, async (c) => {
  const [totalVehicles, totalBids, totalUsers, payments] = await Promise.all([
    Vehicle.countDocuments(),
    Bid.countDocuments(),
    User.countDocuments(),
    Payment.find({ status: "paid" }),
  ]);

  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
  const activeAuctions = await Vehicle.countDocuments({ status: "active" });
  const awardedVehicles = await Vehicle.countDocuments({ status: "awarded" });

  return c.json({
    totalVehicles,
    totalBids,
    totalUsers,
    totalRevenue,
    activeAuctions,
    awardedVehicles,
  });
});

dashboard.get("/reports", requireAdmin, async (c) => {
  const vehiclesByStatus = await Vehicle.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const topBids = await Bid.find()
    .populate("vehicleId", "title brand model")
    .populate("userId", "name email")
    .sort({ amount: -1 })
    .limit(10);

  const recentVehicles = await Vehicle.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .select("title brand model status currentPrice createdAt");

  return c.json({ vehiclesByStatus, topBids, recentVehicles });
});

export default dashboard;
