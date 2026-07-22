import { useEffect, useState } from "react";
import { useApi } from "../../hooks/useApi";
import Card from "../../components/Card";
import PageHeader from "../../components/PageHeader";
import LoadingState from "../../components/LoadingState";
import AdminStatCard from "../../components/AdminStatCard";
import DateRangePicker from "../../components/admin/DateRangePicker";
import StatusDonutChart from "../../components/admin/charts/StatusDonutChart";
import ExportCsvButton from "../../components/admin/ExportCsvButton";

interface StatusGroup {
  _id: string;
  count: number;
}

interface Analytics {
  vehiclesByStatus: StatusGroup[];
  averageTicket: number;
  adjudicationRate: number;
  totalRefunded: number;
  uniqueBuyers: number;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function AdminReports() {
  const api = useApi();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState({ from: isoDaysAgo(30), to: isoDaysAgo(0) });

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ from: range.from, to: range.to });
    api
      .get(`/api/dashboard/analytics?${params}`)
      .then((r) => setAnalytics(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [range.from, range.to]);

  const vehiclesByStatus = analytics?.vehiclesByStatus ?? [];
  const total = vehiclesByStatus.reduce((s, g) => s + g.count, 0);

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Análisis"
        title="Reportes"
        subtitle="Distribución del inventario y métricas de negocio"
        actions={<DateRangePicker from={range.from} to={range.to} onChange={setRange} />}
      />

      {loading && !analytics ? (
        <LoadingState />
      ) : (
        <>
          <div className="kpi-row" style={{ marginBottom: "var(--sp-5)" }}>
            <AdminStatCard label="Inventario en el rango" value={total} />
            <AdminStatCard label="Ticket promedio" value={`$${Math.round(analytics?.averageTicket ?? 0).toLocaleString()}`} />
            <AdminStatCard label="Tasa de adjudicación" value={`${Math.round((analytics?.adjudicationRate ?? 0) * 100)}%`} />
            <AdminStatCard label="Compradores únicos" value={analytics?.uniqueBuyers ?? 0} />
            <AdminStatCard label="Reembolsado" value={`$${(analytics?.totalRefunded ?? 0).toLocaleString()}`} />
          </div>

          <Card padding="lg">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--sp-5)" }}>
              <div>
                <h2 style={{ fontSize: "var(--t-md)", color: "var(--text)" }}>Vehículos por estado</h2>
                <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", marginTop: 4 }}>
                  Distribución en el rango seleccionado ({total} totales)
                </p>
              </div>
              <ExportCsvButton
                data={vehiclesByStatus}
                filename="vehiculos-por-estado"
                columns={[
                  { header: "Estado", accessor: (g) => g._id },
                  { header: "Cantidad", accessor: (g) => g.count },
                ]}
              />
            </div>

            {vehiclesByStatus.length === 0 ? (
              <p style={{ color: "var(--text-soft)", textAlign: "center", padding: "var(--sp-5)" }}>
                Sin datos disponibles
              </p>
            ) : (
              <StatusDonutChart data={vehiclesByStatus} />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
