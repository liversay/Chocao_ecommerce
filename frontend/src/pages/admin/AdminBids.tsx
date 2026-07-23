import { useEffect, useMemo, useState } from "react";
import { useApi } from "../../hooks/useApi";
import { useRealtimeRefetch } from "../../hooks/useRealtimeRefetch";
import { usePersistedState } from "../../hooks/usePersistedState";
import Card from "../../components/Card";
import Input from "../../components/Input";
import DataTable from "../../components/DataTable";
import StatusBadge from "../../components/StatusBadge";
import PageHeader from "../../components/PageHeader";
import LoadingState from "../../components/LoadingState";
import EmptyState from "../../components/EmptyState";
import FilterPanel from "../../components/admin/FilterPanel";
import FilterCheckboxGroup from "../../components/FilterCheckboxGroup";
import { toggleValue } from "../../utils/toggleValue";
import type { Bid } from "../../types";

const BID_STATUS_OPTIONS = [
  { value: "active", label: "Activo" },
  { value: "outbid", label: "Superado" },
  { value: "winner", label: "Ganador" },
  { value: "paid", label: "Pagado" },
];

interface BidFilters {
  status: string[];
  minAmount: string;
  maxAmount: string;
  dateFrom: string;
  dateTo: string;
}

const EMPTY_BID_FILTERS: BidFilters = { status: [], minAmount: "", maxAmount: "", dateFrom: "", dateTo: "" };

function countActive(f: BidFilters): number {
  let count = 0;
  if (f.status.length > 0) count++;
  if (f.minAmount || f.maxAmount) count++;
  if (f.dateFrom || f.dateTo) count++;
  return count;
}

export default function AdminBids() {
  const api = useApi();
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = usePersistedState<BidFilters>("chocao.admin.filters.bids", EMPTY_BID_FILTERS);

  function update(patch: Partial<BidFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  function load() {
    api.get("/api/bids")
      .then((r) => setBids(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);
  useRealtimeRefetch(["bid.placed"], load);

  const filteredBids = useMemo(() => {
    const min = filters.minAmount ? parseFloat(filters.minAmount) : undefined;
    const max = filters.maxAmount ? parseFloat(filters.maxAmount) : undefined;
    const from = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`).getTime() : undefined;
    const to = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59.999`).getTime() : undefined;

    return bids.filter((b) => {
      if (filters.status.length > 0 && !filters.status.includes(b.status)) return false;
      if (min !== undefined && !isNaN(min) && b.amount < min) return false;
      if (max !== undefined && !isNaN(max) && b.amount > max) return false;
      const createdAt = new Date(b.createdAt).getTime();
      if (from !== undefined && createdAt < from) return false;
      if (to !== undefined && createdAt > to) return false;
      return true;
    });
  }, [bids, filters]);

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Actividad"
        title="Ofertas registradas"
        subtitle="Todas las pujas realizadas en el sistema"
      />

      {!loading && bids.length > 0 && (
        <FilterPanel activeCount={countActive(filters)}>
          <div>
            <span className="field-label">Estado</span>
            <FilterCheckboxGroup
              options={BID_STATUS_OPTIONS}
              selected={filters.status}
              onToggle={(v) => update({ status: toggleValue(filters.status, v) })}
            />
          </div>
          <div className="grid-2" style={{ gap: "var(--sp-3)" }}>
            <div style={{ display: "flex", gap: "var(--sp-3)" }}>
              <Input label="Monto mín. (USD)" type="number" min={0} value={filters.minAmount} onChange={(e) => update({ minAmount: e.target.value })} />
              <Input label="Monto máx. (USD)" type="number" min={0} value={filters.maxAmount} onChange={(e) => update({ maxAmount: e.target.value })} />
            </div>
            <div style={{ display: "flex", gap: "var(--sp-3)" }}>
              <Input label="Puja desde" type="date" value={filters.dateFrom} onChange={(e) => update({ dateFrom: e.target.value })} />
              <Input label="Puja hasta" type="date" value={filters.dateTo} onChange={(e) => update({ dateTo: e.target.value })} />
            </div>
          </div>
        </FilterPanel>
      )}

      <Card>
        {loading ? (
          <LoadingState />
        ) : bids.length === 0 ? (
          <EmptyState icon="◈" title="No hay pujas registradas" description="Las pujas aparecerán aquí cuando los usuarios participen en subastas." />
        ) : (
          <DataTable
            dense
            columns={[
              {
                header: "Vehículo",
                accessor: (b) =>
                  typeof b.vehicleId === "object" && b.vehicleId
                    ? <span style={{ fontWeight: 600, color: "var(--text)" }}>{(b.vehicleId as { title: string }).title}</span>
                    : "—",
              },
              {
                header: "Usuario",
                accessor: (b) => {
                  if (typeof b.userId !== "object" || !b.userId) return "—";
                  const u = b.userId as { name: string; email: string };
                  return (
                    <div>
                      <p style={{ fontWeight: 600, color: "var(--text)", fontSize: "var(--t-sm)" }}>{u.name}</p>
                      <p style={{ fontSize: "var(--t-xs)", color: "var(--text-soft)" }}>{u.email}</p>
                    </div>
                  );
                },
              },
              {
                header: "Monto",
                align: "right",
                accessor: (b) => (
                  <span className="mono" style={{ fontWeight: 600 }}>
                    ${(b.amount as number).toLocaleString()}
                  </span>
                ),
              },
              {
                header: "Estado",
                accessor: (b) => <StatusBadge status={b.status} />,
              },
              {
                header: "Fecha",
                align: "right",
                sortKey: "createdAt",
                sortValue: (b) => new Date(b.createdAt).getTime(),
                accessor: (b) => (
                  <span style={{ color: "var(--text-muted)", fontSize: "var(--t-xs)" }}>
                    {new Date(b.createdAt).toLocaleDateString("es-PA", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                ),
              },
            ]}
            data={filteredBids}
            emptyMessage="No hay pujas que coincidan con los filtros"
          />
        )}
      </Card>
    </div>
  );
}
