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

interface ReportPayment {
  _id: string;
  amount: number;
  status: "pending" | "paid" | "cancelled" | "refunded";
  userId: { _id: string } | string | null;
  vehicleId: { _id: string } | string | null;
}

export default function AdminReports() {
  const api = useApi();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [payments, setPayments] = useState<ReportPayment[]>([]);

  // Filtros de la tabla de vehículos, persistidos entre visitas.
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
    setVehiclesLoading(true);
    api
      .get("/api/vehicles/admin/all")
      .then((r) => setVehicles(r.data))
      .catch(console.error)
      .finally(() => setVehiclesLoading(false));
    // Pagos del inventario completo (tope de 100, el máximo del endpoint) —
    // se cruzan con los vehículos filtrados para que el KPI-row reaccione a
    // TODOS los filtros (no solo la fecha), igual que la tabla de abajo.
    api
      .get("/api/payments?limit=100")
      .then((r) => setPayments(r.data.items))
      .catch(console.error);
  }, []);

  const filteredVehicles = useMemo(
    () => filterAdminVehicles(vehicles, search, range, instant),
    [vehicles, search, range, instant]
  );

  // KPIs derivados enteramente del inventario ya filtrado: cambian con
  // cualquier filtro aplicado (búsqueda, estado, precio, año, km, marca,
  // transmisión, carrocería, fecha de registro), no solo con la fecha.
  const kpis = useMemo(() => {
    const filteredIds = new Set(filteredVehicles.map((v) => v._id));
    const relevantPayments = payments.filter((p) => {
      const vehicleId = typeof p.vehicleId === "string" ? p.vehicleId : p.vehicleId?._id;
      return vehicleId ? filteredIds.has(vehicleId) : false;
    });
    const paid = relevantPayments.filter((p) => p.status === "paid");
    const refunded = relevantPayments.filter((p) => p.status === "refunded");
    const awarded = filteredVehicles.filter((v) => v.status === "awarded");

    return {
      inventoryCount: filteredVehicles.length,
      averageTicket: paid.length > 0 ? paid.reduce((s, p) => s + p.amount, 0) / paid.length : 0,
      adjudicationRate: filteredVehicles.length > 0 ? awarded.length / filteredVehicles.length : 0,
      uniqueBuyers: new Set(
        paid.map((p) => (typeof p.userId === "string" ? p.userId : p.userId?._id)).filter(Boolean)
      ).size,
      totalRefunded: refunded.reduce((s, p) => s + p.amount, 0),
    };
  }, [filteredVehicles, payments]);

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

      {vehiclesLoading ? (
        <LoadingState />
      ) : (
        <>
          <div className="kpi-row" style={{ marginBottom: "var(--sp-5)" }}>
            <AdminStatCard label="Inventario filtrado" value={kpis.inventoryCount} />
            <AdminStatCard label="Ticket promedio" value={`$${Math.round(kpis.averageTicket).toLocaleString()}`} />
            <AdminStatCard label="Tasa de adjudicación" value={`${Math.round(kpis.adjudicationRate * 100)}%`} />
            <AdminStatCard label="Compradores únicos" value={kpis.uniqueBuyers} />
            <AdminStatCard label="Reembolsado" value={`$${kpis.totalRefunded.toLocaleString()}`} />
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
