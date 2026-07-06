import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../hooks/useApi";
import Card from "../../components/Card";
import Button from "../../components/Button";
import DataTable from "../../components/DataTable";
import StatusBadge from "../../components/StatusBadge";
import PageHeader from "../../components/PageHeader";
import LoadingState from "../../components/LoadingState";
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

export default function AdminDashboard() {
  const api = useApi();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentVehicles, setRecentVehicles] = useState<RecentVehicle[]>([]);
  const [topBids, setTopBids] = useState<TopBid[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get("/api/dashboard/summary"), api.get("/api/dashboard/reports")])
      .then(([sumRes, repRes]) => {
        setSummary(sumRes.data);
        setRecentVehicles(repRes.data.recentVehicles);
        setTopBids(repRes.data.topBids);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Cargando dashboard..." />;

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Panel administrativo"
        title="Dashboard"
        subtitle="Resumen general del sistema y métricas en tiempo real"
        actions={
          <Link to="/admin/vehicles">
            <Button variant="primary">+ Nuevo vehículo</Button>
          </Link>
        }
      />

      {summary && (
        <div className="kpi-row" style={{ marginBottom: "var(--sp-6)" }}>
          <div className="kpi">
            <p className="kpi-value">{summary.totalVehicles}</p>
            <p className="kpi-label">Vehículos totales</p>
          </div>
          <div className="kpi">
            <p className="kpi-value">{summary.activeAuctions}</p>
            <p className="kpi-label">Subastas activas</p>
          </div>
          <div className="kpi">
            <p className="kpi-value">{summary.awardedVehicles}</p>
            <p className="kpi-label">Adjudicados</p>
          </div>
          <div className="kpi">
            <p className="kpi-value">{summary.totalBids}</p>
            <p className="kpi-label">Total pujas</p>
          </div>
          <div className="kpi">
            <p className="kpi-value">{summary.totalUsers}</p>
            <p className="kpi-label">Usuarios</p>
          </div>
          <div className="kpi">
            <p className="kpi-value mono">${summary.totalRevenue.toLocaleString()}</p>
            <p className="kpi-label">Recaudado</p>
          </div>
        </div>
      )}

      {/* Two-column tables */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-4)" }}>
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
