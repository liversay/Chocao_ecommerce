import { useEffect, useState } from "react";
import { useApi } from "../../hooks/useApi";
import Card from "../../components/Card";
import PageHeader from "../../components/PageHeader";
import LoadingState from "../../components/LoadingState";
import AdminStatCard from "../../components/AdminStatCard";
import DataTable from "../../components/DataTable";
import DateRangePicker from "../../components/admin/DateRangePicker";
import StatusDonutChart from "../../components/admin/charts/StatusDonutChart";
import ExportCsvButton from "../../components/admin/ExportCsvButton";
import type { Vehicle } from "../../types";

interface StatusGroup {
  _id: string;
  count: number;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  published: "Publicado",
  active: "Activo",
  closed: "Cerrado",
  awarded: "Adjudicado",
};

const TRANSMISSION_LABELS: Record<string, string> = {
  manual: "Manual",
  automatic: "Automático",
};

const BODY_STYLE_LABELS: Record<string, string> = {
  sedan: "Sedán",
  suv: "SUV",
  pickup: "Pickup",
  van: "Bus / Coaster / Van",
  panel: "Panel",
};

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
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ from: range.from, to: range.to });
    api
      .get(`/api/dashboard/analytics?${params}`)
      .then((r) => setAnalytics(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [range.from, range.to]);

  useEffect(() => {
    setVehiclesLoading(true);
    api
      .get("/api/vehicles/admin/all")
      .then((r) => setVehicles(r.data))
      .catch(console.error)
      .finally(() => setVehiclesLoading(false));
  }, []);

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

          <Card padding="lg" style={{ marginTop: "var(--sp-5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--sp-5)" }}>
              <div>
                <h2 style={{ fontSize: "var(--t-md)", color: "var(--text)" }}>Todos los vehículos</h2>
                <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", marginTop: 4 }}>
                  Inventario completo ({vehicles.length} vehículos)
                </p>
              </div>
              <ExportCsvButton
                data={vehicles}
                filename="todos-los-vehiculos"
                columns={[
                  { header: "Título", accessor: (v) => v.title },
                  { header: "Marca", accessor: (v) => v.brand },
                  { header: "Modelo", accessor: (v) => v.model },
                  { header: "Año", accessor: (v) => v.year },
                  { header: "Transmisión", accessor: (v) => (v.transmission ? TRANSMISSION_LABELS[v.transmission] ?? v.transmission : "") },
                  { header: "Carrocería", accessor: (v) => (v.bodyStyle ? BODY_STYLE_LABELS[v.bodyStyle] ?? v.bodyStyle : "") },
                  { header: "Estado", accessor: (v) => STATUS_LABELS[v.status] ?? v.status },
                  { header: "Precio", accessor: (v) => v.currentPrice },
                  { header: "Kilometraje", accessor: (v) => v.mileage ?? "" },
                  {
                    header: "Fecha de registro",
                    accessor: (v) => new Date(v.createdAt).toLocaleDateString("es-PA", { day: "numeric", month: "short", year: "numeric" }),
                  },
                ]}
              />
            </div>

            {vehiclesLoading ? (
              <LoadingState />
            ) : (
              <DataTable
                dense
                columns={[
                  {
                    header: "Vehículo",
                    accessor: (v) => (
                      <div>
                        <p style={{ fontWeight: 600, color: "var(--text)" }}>{v.title}</p>
                        <p style={{ fontSize: "var(--t-xs)", color: "var(--text-soft)" }}>
                          {v.brand} · {v.model}
                        </p>
                      </div>
                    ),
                  },
                  { header: "Año", accessor: (v) => v.year },
                  {
                    header: "Transmisión",
                    accessor: (v) => (v.transmission ? TRANSMISSION_LABELS[v.transmission] ?? v.transmission : "—"),
                  },
                  {
                    header: "Carrocería",
                    accessor: (v) => (v.bodyStyle ? BODY_STYLE_LABELS[v.bodyStyle] ?? v.bodyStyle : "—"),
                  },
                  { header: "Estado", accessor: (v) => STATUS_LABELS[v.status] ?? v.status },
                  {
                    header: "Precio",
                    align: "right",
                    accessor: (v) => (
                      <span className="mono" style={{ fontWeight: 600 }}>
                        ${v.currentPrice.toLocaleString()}
                      </span>
                    ),
                  },
                  {
                    header: "Kilometraje",
                    align: "right",
                    accessor: (v) => <span className="mono">{v.mileage != null ? v.mileage.toLocaleString() : "—"}</span>,
                  },
                  {
                    header: "Fecha de registro",
                    sortKey: "createdAt",
                    sortValue: (v) => new Date(v.createdAt).getTime(),
                    accessor: (v) => (
                      <span style={{ color: "var(--text-muted)", fontSize: "var(--t-xs)" }}>
                        {new Date(v.createdAt).toLocaleDateString("es-PA", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    ),
                  },
                ]}
                data={vehicles}
                emptyMessage="No hay vehículos registrados"
              />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
