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

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

export interface Analytics {
  vehiclesByStatus: { _id: string; count: number }[];
  revenueByDay: TimeSeriesPoint[];
  bidsByDay: TimeSeriesPoint[];
  averageTicket: number;
  adjudicationRate: number;
  totalRefunded: number;
  uniqueBuyers: number;
}

// Analítica elaborada del backoffice: series de tiempo de ingresos y pujas,
// más métricas derivadas (ticket promedio, tasa de adjudicación, reembolsado
// total, compradores únicos). Acotable al mismo rango [from, to] que
// getReports. Mismo servicio para GET /api/dashboard/analytics.
export async function getAnalytics({ from, to }: ReportsParams = {}): Promise<Analytics> {
  const createdAtFilter =
    from || to
      ? { createdAt: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } }
      : {};

  const [
    vehiclesByStatus,
    revenueByDay,
    bidsByDay,
    paidPayments,
    refundedPayments,
    totalVehicles,
    awardedVehicles,
  ] = await Promise.all([
    Vehicle.aggregate([
      ...(from || to ? [{ $match: createdAtFilter }] : []),
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      { $match: { status: "paid", ...createdAtFilter } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          value: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Bid.aggregate([
      { $match: createdAtFilter },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          value: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Payment.find({ status: "paid", ...createdAtFilter }),
    Payment.find({ status: "refunded", ...createdAtFilter }),
    Vehicle.countDocuments(createdAtFilter),
    Vehicle.countDocuments({ status: "awarded", ...createdAtFilter }),
  ]);

  const averageTicket =
    paidPayments.length > 0 ? paidPayments.reduce((s, p) => s + p.amount, 0) / paidPayments.length : 0;
  const totalRefunded = refundedPayments.reduce((s, p) => s + p.amount, 0);
  const uniqueBuyers = new Set(paidPayments.map((p) => p.userId.toString())).size;
  const adjudicationRate = totalVehicles > 0 ? awardedVehicles / totalVehicles : 0;

  return {
    vehiclesByStatus,
    revenueByDay: revenueByDay.map((r) => ({ date: r._id as string, value: r.value as number })),
    bidsByDay: bidsByDay.map((r) => ({ date: r._id as string, value: r.value as number })),
    averageTicket,
    adjudicationRate,
    totalRefunded,
    uniqueBuyers,
  };
}
