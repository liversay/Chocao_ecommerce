import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../hooks/useApi";
import AdminStatCard from "../../components/AdminStatCard";
import GlassCard from "../../components/GlassCard";
import GlassButton from "../../components/GlassButton";
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
            <GlassButton variant="primary">+ Nuevo vehículo</GlassButton>
          </Link>
        }
      />

      {/* Stats grid */}
      {summary && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "var(--sp-4)",
          marginBottom: "var(--sp-6)",
        }}>
          <AdminStatCard label="Vehículos totales" value={summary.totalVehicles} icon="▦" accent="primary" />
          <AdminStatCard label="Subastas activas" value={summary.activeAuctions} icon="◉" accent="success" />
          <AdminStatCard label="Adjudicados" value={summary.awardedVehicles} icon="★" accent="accent" />
          <AdminStatCard label="Total pujas" value={summary.totalBids} icon="◈" accent="primary" />
          <AdminStatCard label="Usuarios" value={summary.totalUsers} icon="◐" accent="primary" />
          <AdminStatCard
            label="Recaudado"
            value={`$${summary.totalRevenue.toLocaleString()}`}
            icon="$"
            accent="accent"
          />
        </div>
      )}

      {/* Two-column tables */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-4)" }}>
        <GlassCard>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-4)" }}>
            <h2 style={{ fontSize: "var(--t-md)", color: "var(--text)" }}>Vehículos recientes</h2>
            <Link to="/admin/vehicles">
              <GlassButton variant="ghost" size="sm">Ver todos →</GlassButton>
            </Link>
          </div>
          <DataTable
            columns={[
              { header: "Título", accessor: (v) => (
                <span style={{ fontWeight: 600, color: "var(--text)" }}>{v.title}</span>
              ) },
              { header: "Estado", accessor: (v) => <StatusBadge status={v.status} /> },
              { header: "Precio", align: "right", accessor: (v) => (
                <span style={{ color: "var(--accent)", fontWeight: 700 }}>
                  ${v.currentPrice.toLocaleString()}
                </span>
              ) },
            ]}
            data={recentVehicles}
            emptyMessage="Sin vehículos"
          />
        </GlassCard>

        <GlassCard>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-4)" }}>
            <h2 style={{ fontSize: "var(--t-md)", color: "var(--text)" }}>Top pujas</h2>
            <Link to="/admin/bids">
              <GlassButton variant="ghost" size="sm">Ver todas →</GlassButton>
            </Link>
          </div>
          <DataTable
            columns={[
              { header: "Monto", accessor: (b) => (
                <span style={{ color: "var(--accent)", fontWeight: 700 }}>
                  ${b.amount.toLocaleString()}
                </span>
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
        </GlassCard>
      </div>
    </div>
  );
}
