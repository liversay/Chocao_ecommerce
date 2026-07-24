// frontend/src/pages/admin/AdminEntregasBloqueadas.tsx
import { useEffect, useState } from "react";
import { useApi } from "../../hooks/useApi";
import Card from "../../components/Card";
import DataTable from "../../components/DataTable";
import StatusBadge from "../../components/StatusBadge";
import PageHeader from "../../components/PageHeader";
import LoadingState from "../../components/LoadingState";
import type { Entrega, Vehicle, User } from "../../types";

type EntregaBloqueada = Omit<Entrega, "vehicleId" | "compradorId"> & {
  vehicleId: Vehicle | null;
  compradorId: User | null;
};

export default function AdminEntregasBloqueadas() {
  const api = useApi();
  const [items, setItems] = useState<EntregaBloqueada[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    const params = new URLSearchParams({ estado: "BLOQUEADA", page: String(page), limit: "20" });
    api
      .get(`/api/entrega?${params}`)
      .then((r) => {
        setItems(r.data.items);
        setTotal(r.data.total);
        setPages(r.data.pages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(load, [page]);

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Gestión"
        title="Entregas bloqueadas"
        subtitle={`${total} entregas escaladas por discrepancia de VIN`}
      />

      <Card padding="none">
        {loading && items.length === 0 ? (
          <LoadingState />
        ) : (
          <DataTable<EntregaBloqueada>
            columns={[
              {
                header: "Vehículo",
                accessor: (e) => (
                  <div>
                    <p style={{ fontWeight: 600, color: "var(--text)", fontSize: "var(--t-sm)" }}>
                      {e.vehicleId?.title ?? "—"}
                    </p>
                    <p style={{ color: "var(--text-soft)", fontSize: "10.5px" }}>
                      {e.vehicleId ? `${e.vehicleId.brand} · ${e.vehicleId.model} · ${e.vehicleId.year}` : ""}
                    </p>
                  </div>
                ),
              },
              {
                header: "Comprador",
                accessor: (e) => (
                  <div>
                    <p style={{ fontWeight: 600, color: "var(--text)", fontSize: "var(--t-sm)" }}>
                      {e.compradorId?.name ?? "—"}
                    </p>
                    <p style={{ color: "var(--text-soft)", fontSize: "10.5px" }}>{e.compradorId?.email ?? ""}</p>
                  </div>
                ),
              },
              { header: "Estado", accessor: (e) => <StatusBadge status={e.estado} /> },
              {
                header: "Motivo de bloqueo",
                accessor: (e) => (
                  <span style={{ color: "var(--danger)", fontSize: "var(--t-xs)", fontWeight: 500 }}>
                    {e.motivoBloqueo ?? "—"}
                  </span>
                ),
              },
              {
                header: "VIN capturado",
                accessor: (e) => <span className="mono" style={{ fontSize: "var(--t-xs)" }}>{e.vinCapturado ?? "—"}</span>,
              },
              {
                header: "Fecha",
                accessor: (e) => (
                  <span style={{ color: "var(--text-muted)", fontSize: "var(--t-xs)" }}>
                    {new Date(e.updatedAt).toLocaleDateString("es-PA", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                ),
              },
            ]}
            data={items}
            emptyMessage="No hay entregas bloqueadas"
            page={page}
            pages={pages}
            onPageChange={setPage}
          />
        )}
      </Card>
    </div>
  );
}
