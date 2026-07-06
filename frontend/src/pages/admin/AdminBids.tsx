import { useEffect, useState } from "react";
import { useApi } from "../../hooks/useApi";
import Card from "../../components/Card";
import DataTable from "../../components/DataTable";
import StatusBadge from "../../components/StatusBadge";
import PageHeader from "../../components/PageHeader";
import LoadingState from "../../components/LoadingState";
import EmptyState from "../../components/EmptyState";
import type { Bid } from "../../types";

export default function AdminBids() {
  const api = useApi();
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/bids")
      .then((r) => setBids(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Actividad"
        title="Ofertas registradas"
        subtitle="Todas las pujas realizadas en el sistema"
      />

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
                accessor: (b) => (
                  <span style={{ color: "var(--text-muted)", fontSize: "var(--t-xs)" }}>
                    {new Date(b.createdAt).toLocaleDateString("es-PA", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                ),
              },
            ]}
            data={bids}
            emptyMessage="No hay pujas registradas"
          />
        )}
      </Card>
    </div>
  );
}
