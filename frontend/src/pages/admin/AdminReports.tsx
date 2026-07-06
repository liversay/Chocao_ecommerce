import { useEffect, useState } from "react";
import { useApi } from "../../hooks/useApi";
import Card from "../../components/Card";
import StatusBadge from "../../components/StatusBadge";
import PageHeader from "../../components/PageHeader";
import LoadingState from "../../components/LoadingState";

interface StatusGroup {
  _id: string;
  count: number;
}

function barColor(status: string): string {
  if (status === "closed") return "var(--danger)";
  if (status === "active") return "var(--success)";
  return "var(--primary)";
}

export default function AdminReports() {
  const api = useApi();
  const [vehiclesByStatus, setVehiclesByStatus] = useState<StatusGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/dashboard/reports")
      .then((r) => setVehiclesByStatus(r.data.vehiclesByStatus))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const total = vehiclesByStatus.reduce((s, g) => s + g.count, 0);
  const awardedCount = vehiclesByStatus.find((g) => g._id === "awarded")?.count || 0;
  const activeCount = vehiclesByStatus.find((g) => g._id === "active")?.count || 0;

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Análisis"
        title="Reportes"
        subtitle="Distribución del inventario y métricas clave"
      />

      <div className="kpi-row" style={{ marginBottom: "var(--sp-5)" }}>
        <div className="kpi">
          <p className="kpi-value">{total}</p>
          <p className="kpi-label">Inventario total</p>
        </div>
        <div className="kpi">
          <p className="kpi-value">{activeCount}</p>
          <p className="kpi-label">Subastas activas</p>
        </div>
        <div className="kpi">
          <p className="kpi-value">{awardedCount}</p>
          <p className="kpi-label">Adjudicados</p>
        </div>
        <div className="kpi">
          <p className="kpi-value">{total > 0 ? `${Math.round((awardedCount / total) * 100)}%` : "0%"}</p>
          <p className="kpi-label">Tasa de adjudicación</p>
        </div>
      </div>

      <Card padding="lg">
        <div style={{ marginBottom: "var(--sp-5)" }}>
          <h2 style={{ fontSize: "var(--t-md)", color: "var(--text)" }}>
            Vehículos por estado
          </h2>
          <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", marginTop: 4 }}>
            Distribución actual del inventario ({total} totales)
          </p>
        </div>

        {loading ? (
          <LoadingState />
        ) : vehiclesByStatus.length === 0 ? (
          <p style={{ color: "var(--text-soft)", textAlign: "center", padding: "var(--sp-5)" }}>
            Sin datos disponibles
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
            {vehiclesByStatus.map((g) => {
              const pct = total > 0 ? Math.round((g.count / total) * 100) : 0;
              return (
                <div key={g._id} style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)" }}>
                  <div style={{ width: 130, flexShrink: 0 }}>
                    <StatusBadge status={g._id} />
                  </div>
                  <div className="bar-track" style={{ flex: 1 }}>
                    <div className="bar-fill" style={{ width: `${pct}%`, background: barColor(g._id) }} />
                  </div>
                  <span className="mono" style={{ width: 48, textAlign: "right", flexShrink: 0, color: "var(--text-muted)" }}>
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
