import { useEffect, useState } from "react";
import { useApi } from "../../hooks/useApi";
import GlassCard from "../../components/GlassCard";
import StatusBadge from "../../components/StatusBadge";
import PageHeader from "../../components/PageHeader";
import LoadingState from "../../components/LoadingState";

interface StatusGroup {
  _id: string;
  count: number;
}

const colorMap: Record<string, string> = {
  draft: "var(--text-soft)",
  published: "var(--primary-500)",
  active: "var(--success)",
  closed: "var(--danger)",
  awarded: "var(--accent)",
};

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

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Análisis"
        title="Reportes"
        subtitle="Distribución del inventario y métricas clave"
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-4)" }}>
        <GlassCard padding="lg">
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
                const color = colorMap[g._id] || "var(--primary)";
                return (
                  <div key={g._id}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <StatusBadge status={g._id} />
                      <div style={{ textAlign: "right" }}>
                        <span style={{ color: "var(--text)", fontWeight: 700, fontSize: "var(--t-md)" }}>
                          {g.count}
                        </span>
                        <span style={{ color: "var(--text-soft)", fontSize: "var(--t-xs)", marginLeft: 8 }}>
                          ({pct}%)
                        </span>
                      </div>
                    </div>
                    <div
                      style={{
                        height: 10,
                        background: "var(--surface)",
                        borderRadius: "var(--radius-pill)",
                        boxShadow: "var(--nm-in-sm)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${pct}%`,
                          background: color,
                          borderRadius: "var(--radius-pill)",
                          transition: "width 0.6s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>

        <GlassCard padding="lg">
          <div style={{ marginBottom: "var(--sp-5)" }}>
            <h2 style={{ fontSize: "var(--t-md)", color: "var(--text)" }}>
              Resumen general
            </h2>
            <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", marginTop: 4 }}>
              Indicadores rápidos del sistema
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
            {[
              {
                label: "Tasa de adjudicación",
                value: total > 0
                  ? `${Math.round(((vehiclesByStatus.find(g => g._id === "awarded")?.count || 0) / total) * 100)}%`
                  : "0%",
                hint: "Vehículos adjudicados sobre el total",
              },
              {
                label: "Subastas activas",
                value: vehiclesByStatus.find(g => g._id === "active")?.count || 0,
                hint: "Disponibles para pujas en este momento",
              },
              {
                label: "Inventario total",
                value: total,
                hint: "Todos los vehículos registrados",
              },
            ].map((m) => (
              <div
                key={m.label}
                style={{
                  padding: "var(--sp-4)",
                  background: "var(--surface)",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "var(--nm-in-sm)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <p style={{ fontSize: "var(--t-sm)", fontWeight: 600, color: "var(--text)" }}>
                    {m.label}
                  </p>
                  <p style={{ fontSize: "var(--t-xs)", color: "var(--text-soft)", marginTop: 2 }}>
                    {m.hint}
                  </p>
                </div>
                <p style={{
                  fontSize: "var(--t-xl)",
                  fontWeight: 800,
                  color: "var(--primary)",
                  letterSpacing: "-0.02em",
                }}>
                  {m.value}
                </p>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
