import { useEffect, useMemo, useState } from "react";
import { useApi } from "../../hooks/useApi";
import { usePersistedState } from "../../hooks/usePersistedState";
import Card from "../../components/Card";
import PageHeader from "../../components/PageHeader";
import LoadingState from "../../components/LoadingState";
import AdminStatCard from "../../components/AdminStatCard";
import DataTable from "../../components/DataTable";
import ExportCsvButton from "../../components/admin/ExportCsvButton";
import AdminVehicleFilters from "../../components/admin/AdminVehicleFilters";
import { VEHICLE_STATUS_LABELS } from "../../constants/vehicleStatus";
import { filterAdminVehicles } from "../../utils/filterAdminVehicles";
import { EMPTY_ADMIN_VEHICLE_RANGE, EMPTY_ADMIN_VEHICLE_INSTANT } from "../../types/adminVehicleFilters";
import type { AdminVehicleRangeDraft, AdminVehicleInstantFilters } from "../../types/adminVehicleFilters";
import type { Vehicle } from "../../types";

interface StatusGroup {
  _id: string;
  count: number;
}

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

export default function AdminReports() {
  const api = useApi();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);

  // Filtros de la tabla de vehículos, persistidos entre visitas. El rango de
  // fecha (dateFrom/dateTo) también acota la analítica (ticket promedio,
  // adjudicación, etc.), igual que antes hacía el DateRangePicker.
  const [search, setSearch] = usePersistedState("chocao.admin.filters.reports.search", "");
  const [range, setRange] = usePersistedState<AdminVehicleRangeDraft>(
    "chocao.admin.filters.reports.range",
    EMPTY_ADMIN_VEHICLE_RANGE
  );
  const [instant, setInstant] = usePersistedState<AdminVehicleInstantFilters>(
    "chocao.admin.filters.reports.instant",
    EMPTY_ADMIN_VEHICLE_INSTANT
  );

  function updateRange(patch: Partial<AdminVehicleRangeDraft>) {
    setRange((prev) => ({ ...prev, ...patch }));
  }
  function updateInstant(patch: Partial<AdminVehicleInstantFilters>) {
    setInstant((prev) => ({ ...prev, ...patch }));
  }

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (range.dateFrom) params.set("from", range.dateFrom);
    if (range.dateTo) params.set("to", range.dateTo);
    api
      .get(`/api/dashboard/analytics?${params}`)
      .then((r) => setAnalytics(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [range.dateFrom, range.dateTo]);

  useEffect(() => {
    setVehiclesLoading(true);
    api
      .get("/api/vehicles/admin/all")
      .then((r) => setVehicles(r.data))
      .catch(console.error)
      .finally(() => setVehiclesLoading(false));
  }, []);

  const filteredVehicles = useMemo(
    () => filterAdminVehicles(vehicles, search, range, instant),
    [vehicles, search, range, instant]
  );

  const vehiclesByStatus = analytics?.vehiclesByStatus ?? [];
  const total = vehiclesByStatus.reduce((s, g) => s + g.count, 0);

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Análisis"
        title="Reportes"
        subtitle="Distribución del inventario y métricas de negocio"
      />

      <AdminVehicleFilters
        search={search}
        onSearchChange={setSearch}
        range={range}
        onRangeChange={updateRange}
        instant={instant}
        onInstantChange={updateInstant}
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
                <h2 style={{ fontSize: "var(--t-md)", color: "var(--text)" }}>Todos los vehículos</h2>
                <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", marginTop: 4 }}>
                  {filteredVehicles.length} de {vehicles.length} vehículos
                </p>
              </div>
              <ExportCsvButton
                data={filteredVehicles}
                filename="todos-los-vehiculos"
                columns={[
                  { header: "Título", accessor: (v) => v.title },
                  { header: "Marca", accessor: (v) => v.brand },
                  { header: "Modelo", accessor: (v) => v.model },
                  { header: "Año", accessor: (v) => v.year },
                  { header: "Transmisión", accessor: (v) => (v.transmission ? TRANSMISSION_LABELS[v.transmission] ?? v.transmission : "") },
                  { header: "Carrocería", accessor: (v) => (v.bodyStyle ? BODY_STYLE_LABELS[v.bodyStyle] ?? v.bodyStyle : "") },
                  { header: "Estado", accessor: (v) => VEHICLE_STATUS_LABELS[v.status] ?? v.status },
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
                  { header: "Estado", accessor: (v) => VEHICLE_STATUS_LABELS[v.status] ?? v.status },
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
                data={filteredVehicles}
                emptyMessage="No hay vehículos que coincidan con los filtros"
              />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
