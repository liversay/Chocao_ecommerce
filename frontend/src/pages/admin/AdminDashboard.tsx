import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../hooks/useApi";
import { useRealtimeRefetch } from "../../hooks/useRealtimeRefetch";
import Card from "../../components/Card";
import Button from "../../components/Button";
import DataTable from "../../components/DataTable";
import StatusBadge from "../../components/StatusBadge";
import PageHeader from "../../components/PageHeader";
import LoadingState from "../../components/LoadingState";
import AdminStatCard from "../../components/AdminStatCard";
import DateRangePicker from "../../components/admin/DateRangePicker";
import RevenueAreaChart from "../../components/admin/charts/RevenueAreaChart";
import BidsBarChart from "../../components/admin/charts/BidsBarChart";
import type { DashboardSummary } from "../../types";

interface RecentVehicle {
  _id: string;
  title: string;
  brand: string;
  model: string;
  status: string;
  currentPrice: number;
  createdAt: string;
}

interface TopBid {
  _id: string;
  amount: number;
  vehicleId: { title: string; brand: string } | null;
  userId: { name: string; email: string } | null;
  createdAt: string;
}

interface Analytics {
  revenueByDay: { date: string; value: number }[];
  bidsByDay: { date: string; value: number }[];
  averageTicket: number;
  adjudicationRate: number;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function AdminDashboard() {
  const api = useApi();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [recentVehicles, setRecentVehicles] = useState<RecentVehicle[]>([]);
  const [topBids, setTopBids] = useState<TopBid[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState({ from: isoDaysAgo(30), to: isoDaysAgo(0) });

  function load() {
    setLoading(true);
    const params = new URLSearchParams({ from: range.from, to: range.to });
    Promise.all([
      api.get("/api/dashboard/summary"),
      api.get("/api/dashboard/reports"),
      api.get(`/api/dashboard/analytics?${params}`),
    ])
      .then(([sumRes, repRes, anaRes]) => {
        setSummary(sumRes.data);
        setRecentVehicles(repRes.data.recentVehicles);
        setTopBids(repRes.data.topBids);
        setAnalytics(anaRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(load, [range.from, range.to]);
  // Cualquier movimiento de negocio puede mover estas métricas.
  useRealtimeRefetch(["bid.placed", "vehicle.status", "vehicle.updated", "vehicle.removed", "order.updated"], load);

  if (loading && !summary) return <LoadingState message="Cargando dashboard..." />;

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Panel administrativo"
        title="Dashboard"
        subtitle="Resumen general del sistema y métricas en tiempo real"
        actions={<DateRangePicker from={range.from} to={range.to} onChange={setRange} />}
      />

      {summary && (
        <div className="kpi-row" style={{ marginBottom: "var(--sp-5)" }}>
          <AdminStatCard label="Vehículos totales" value={summary.totalVehicles} />
          <AdminStatCard label="Subastas activas" value={summary.activeAuctions} />
          <AdminStatCard label="Adjudicados" value={summary.awardedVehicles} />
          <AdminStatCard label="Total pujas" value={summary.totalBids} />
          <AdminStatCard label="Usuarios" value={summary.totalUsers} />
          <AdminStatCard label="Recaudado" value={`$${summary.totalRevenue.toLocaleString()}`} />
        </div>
      )}

      {analytics && (
        <div className="kpi-row" style={{ marginBottom: "var(--sp-6)" }}>
          <AdminStatCard label="Ticket promedio" value={`$${Math.round(analytics.averageTicket).toLocaleString()}`} hint="En el rango seleccionado" />
          <AdminStatCard label="Tasa de adjudicación" value={`${Math.round(analytics.adjudicationRate * 100)}%`} hint="En el rango seleccionado" />
        </div>
      )}

      {analytics && (
        <div className="grid-2" style={{ gap: "var(--sp-4)", marginBottom: "var(--sp-6)" }}>
          <Card padding="lg">
            <h2 style={{ fontSize: "var(--t-md)", marginBottom: "var(--sp-4)" }}>Ingresos por día</h2>
            <RevenueAreaChart data={analytics.revenueByDay} />
          </Card>
          <Card padding="lg">
            <h2 style={{ fontSize: "var(--t-md)", marginBottom: "var(--sp-4)" }}>Pujas por día</h2>
            <BidsBarChart data={analytics.bidsByDay} />
          </Card>
        </div>
      )}

      <div className="grid-2" style={{ gap: "var(--sp-4)" }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-4)" }}>
            <h2 style={{ fontSize: "var(--t-md)", color: "var(--text)" }}>Vehículos recientes</h2>
            <Link to="/admin/vehicles">
              <Button variant="ghost" size="sm">Ver todos →</Button>
            </Link>
          </div>
          <DataTable
            dense
            columns={[
              { header: "Título", accessor: (v) => (
                <span style={{ fontWeight: 600, color: "var(--text)" }}>{v.title}</span>
              ) },
              { header: "Estado", accessor: (v) => <StatusBadge status={v.status} /> },
              { header: "Precio", align: "right", accessor: (v) => (
                <span className="mono">${v.currentPrice.toLocaleString()}</span>
              ) },
            ]}
            data={recentVehicles}
            emptyMessage="Sin vehículos"
          />
        </Card>

        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-4)" }}>
            <h2 style={{ fontSize: "var(--t-md)", color: "var(--text)" }}>Top pujas</h2>
            <Link to="/admin/bids">
              <Button variant="ghost" size="sm">Ver todas →</Button>
            </Link>
          </div>
          <DataTable
            dense
            columns={[
              { header: "Monto", accessor: (b) => (
                <span className="mono">${b.amount.toLocaleString()}</span>
              ) },
              { header: "Vehículo", accessor: (b) => b.vehicleId?.title || "—" },
              { header: "Usuario", accessor: (b) => (
                <span style={{ color: "var(--text-muted)", fontSize: "var(--t-xs)" }}>
                  {b.userId?.name || "—"}
                </span>
              ) },
            ]}
            data={topBids}
            emptyMessage="Sin pujas"
          />
        </Card>
      </div>
    </div>
  );
}
