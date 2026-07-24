// frontend/src/pages/admin/AdminOrders.tsx
import { useEffect, useState } from "react";
import { useApi } from "../../hooks/useApi";
import { useRealtimeRefetch } from "../../hooks/useRealtimeRefetch";
import Card from "../../components/Card";
import Button from "../../components/Button";
import Select from "../../components/Select";
import DataTable from "../../components/DataTable";
import StatusBadge from "../../components/StatusBadge";
import PageHeader from "../../components/PageHeader";
import LoadingState from "../../components/LoadingState";
import DateRangePicker from "../../components/admin/DateRangePicker";
import ExportCsvButton from "../../components/admin/ExportCsvButton";

interface AdminPaymentAdjudicacion {
  estado:
    | "ADJUDICADA_PENDIENTE_PAGO"
    | "PAGADA"
    | "INCUMPLIDA"
    | "OFERTA_A_SEGUNDO"
    | "DESIERTO_POR_INCUMPLIMIENTO";
  fechaLimitePago: string;
}

interface AdminPayment {
  _id: string;
  amount: number;
  status: "pending" | "paid" | "cancelled" | "refunded";
  createdAt: string;
  userId: { name: string; email: string } | null;
  vehicleId: { title: string; brand: string; model: string } | null;
  adjudicacion: AdminPaymentAdjudicacion | null;
}

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "pending", label: "Pendiente" },
  { value: "paid", label: "Pagado" },
  { value: "refunded", label: "Reembolsado" },
  { value: "cancelled", label: "Cancelado" },
];

export default function AdminOrders() {
  const api = useApi();
  const [items, setItems] = useState<AdminPayment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [status, setStatus] = useState("");
  const [range, setRange] = useState({ from: "", to: "" });
  const [loading, setLoading] = useState(true);
  const [pendingRefund, setPendingRefund] = useState<AdminPayment | null>(null);
  const [refunding, setRefunding] = useState(false);

  function load() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (status) params.set("status", status);
    if (range.from) params.set("from", range.from);
    if (range.to) params.set("to", range.to);
    api
      .get(`/api/payments?${params}`)
      .then((r) => {
        setItems(r.data.items);
        setTotal(r.data.total);
        setPages(r.data.pages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(load, [status, range.from, range.to, page]);
  useRealtimeRefetch(["order.updated"], load);

  async function confirmRefund() {
    if (!pendingRefund) return;
    setRefunding(true);
    try {
      await api.post(`/api/payments/${pendingRefund._id}/refund`);
    } catch (err) {
      console.error("Refund failed:", err);
    } finally {
      setPendingRefund(null);
      load();
      setRefunding(false);
    }
  }

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Gestión"
        title="Órdenes y pagos"
        subtitle={`${total} pagos registrados`}
        actions={<DateRangePicker from={range.from} to={range.to} onChange={setRange} />}
      />

      <Card padding="md" style={{ marginBottom: "var(--sp-4)", display: "flex", justifyContent: "space-between", gap: "var(--sp-3)" }}>
        <div style={{ width: 220 }}>
          <Select options={STATUS_OPTIONS} value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} />
        </div>
        <ExportCsvButton
          data={items}
          filename="pagos"
          columns={[
            { header: "Comprador", accessor: (p) => p.userId?.email ?? "—" },
            { header: "Vehículo", accessor: (p) => p.vehicleId?.title ?? "—" },
            { header: "Monto", accessor: (p) => p.amount },
            { header: "Estado", accessor: (p) => p.status },
            { header: "Fecha", accessor: (p) => new Date(p.createdAt).toISOString() },
          ]}
        />
      </Card>

      <Card padding="none">
        {loading && items.length === 0 ? (
          <LoadingState />
        ) : (
          <DataTable<AdminPayment>
            columns={[
              { header: "Comprador", accessor: (p) => (
                <div>
                  <p style={{ fontWeight: 600, color: "var(--text)", fontSize: "var(--t-sm)" }}>{p.userId?.name ?? "—"}</p>
                  <p style={{ color: "var(--text-soft)", fontSize: "10.5px" }}>{p.userId?.email ?? ""}</p>
                </div>
              ) },
              { header: "Vehículo", accessor: (p) => p.vehicleId?.title ?? "—" },
              { header: "Monto", align: "right", accessor: (p) => (
                <span className="mono" style={{ fontWeight: 700 }}>${p.amount.toLocaleString()}</span>
              ) },
              { header: "Estado", accessor: (p) => <StatusBadge status={p.status} /> },
              {
                header: "Adjudicación",
                accessor: (p) =>
                  p.adjudicacion ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                      <StatusBadge status={p.adjudicacion.estado} />
                      {p.adjudicacion.estado === "ADJUDICADA_PENDIENTE_PAGO" && (
                        <span style={{ color: "var(--text-muted)", fontSize: "10.5px" }}>
                          Vence{" "}
                          {new Date(p.adjudicacion.fechaLimitePago).toLocaleDateString("es-PA", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: "var(--text-soft)", fontSize: "var(--t-xs)" }}>—</span>
                  ),
              },
              { header: "Fecha", accessor: (p) => (
                <span style={{ color: "var(--text-muted)", fontSize: "var(--t-xs)" }}>
                  {new Date(p.createdAt).toLocaleDateString("es-PA", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              ) },
              {
                header: "",
                align: "right",
                accessor: (p) =>
                  p.status === "paid" ? (
                    <Button variant="danger" size="sm" onClick={() => setPendingRefund(p)}>
                      Reembolsar
                    </Button>
                  ) : null,
              },
            ]}
            data={items}
            emptyMessage="Sin pagos que coincidan con el filtro"
            page={page}
            pages={pages}
            onPageChange={setPage}
          />
        )}
      </Card>

      {pendingRefund && (
        <div
          onClick={() => !refunding && setPendingRefund(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "var(--sp-4)",
          }}
        >
          <Card
            variant="elevated"
            padding="lg"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 420, width: "100%", textAlign: "center" }}
          >
            <h3 style={{ fontSize: "var(--t-lg)", color: "var(--text)", marginBottom: "var(--sp-2)" }}>
              ¿Reembolsar ${pendingRefund.amount.toLocaleString()}?
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)", marginBottom: "var(--sp-5)" }}>
              Se reembolsará a {pendingRefund.userId?.email ?? "el comprador"} y el vehículo volverá a estado
              cerrado, disponible para re-adjudicar. Se registra en auditoría.
            </p>
            <div style={{ display: "flex", gap: "var(--sp-2)", justifyContent: "center" }}>
              <Button variant="ghost" onClick={() => setPendingRefund(null)} disabled={refunding}>Cancelar</Button>
              <Button variant="danger" onClick={confirmRefund} disabled={refunding}>
                {refunding ? "Reembolsando..." : "Confirmar reembolso"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
