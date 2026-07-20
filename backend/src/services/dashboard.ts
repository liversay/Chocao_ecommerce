import { Bid } from "../models/Bid";
import { Payment } from "../models/Payment";
import { User } from "../models/User";
import { Vehicle } from "../models/Vehicle";

export interface DashboardSummary {
  totalVehicles: number;
  totalBids: number;
  totalUsers: number;
  totalRevenue: number;
  activeAuctions: number;
  awardedVehicles: number;
}

// KPIs agregados del negocio. Mismo servicio para GET /api/dashboard/summary
// y la tool MCP chocao_dashboard_summary — respuesta idéntica en ambos.
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const [totalVehicles, totalBids, totalUsers, payments, activeAuctions, awardedVehicles] =
    await Promise.all([
      Vehicle.countDocuments(),
      Bid.countDocuments(),
      User.countDocuments(),
      Payment.find({ status: "paid" }),
      Vehicle.countDocuments({ status: "active" }),
      Vehicle.countDocuments({ status: "awarded" }),
    ]);

  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);

  return { totalVehicles, totalBids, totalUsers, totalRevenue, activeAuctions, awardedVehicles };
}

export interface ReportsParams {
  from?: Date;
  to?: Date;
}

// Distribución por estado, top de pujas y vehículos recientes, acotable a un
// rango temporal (createdAt). Mismo servicio para GET /api/dashboard/reports
// y la tool MCP chocao_reports.
export async function getReports({ from, to }: ReportsParams = {}) {
  const createdAtFilter =
    from || to
      ? { createdAt: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } }
      : {};

  const [vehiclesByStatus, topBids, recentVehicles] = await Promise.all([
    Vehicle.aggregate([
      ...(from || to ? [{ $match: createdAtFilter }] : []),
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Bid.find(createdAtFilter)
      .populate("vehicleId", "title brand model")
      .populate("userId", "name email")
      .sort({ amount: -1 })
      .limit(10),
    Vehicle.find(createdAtFilter)
      .sort({ createdAt: -1 })
      .limit(5)
      .select("title brand model status currentPrice createdAt"),
  ]);

  return { vehiclesByStatus, topBids, recentVehicles };
}
