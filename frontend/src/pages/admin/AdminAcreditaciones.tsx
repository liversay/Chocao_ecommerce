// frontend/src/pages/admin/AdminAcreditaciones.tsx
import { useEffect, useState } from "react";
import { useApi } from "../../hooks/useApi";
import Card from "../../components/Card";
import Button from "../../components/Button";
import Select from "../../components/Select";
import DataTable from "../../components/DataTable";
import StatusBadge from "../../components/StatusBadge";
import PageHeader from "../../components/PageHeader";
import LoadingState from "../../components/LoadingState";

interface AdminProponente {
  _id: string;
  documento: { canonico: string; original: string; categoria: string };
  estado: "BORRADOR" | "EN_REVISION" | "ACREDITADO" | "RECHAZADO";
  motivoRechazo?: string;
  createdAt: string;
  userId: { name: string; email: string } | null;
}

type MotivoRechazo = "DOCUMENTO_INVALIDO" | "DOCUMENTO_DUPLICADO" | "VERIFICACION_FALLIDA" | "OTRO";

// Mismos labels que AccountPage.tsx — reutilizar la copia en vez de
// inventar textos nuevos para el mismo concepto en dos pantallas.
const ACREDITACION_BADGE: Record<string, { status: string; label: string }> = {
  BORRADOR: { status: "draft", label: "Borrador" },
  EN_REVISION: { status: "pending", label: "En revisión" },
  ACREDITADO: { status: "active", label: "Acreditado" },
  RECHAZADO: { status: "closed", label: "Rechazado" },
};

const MOTIVO_RECHAZO_LABELS: Record<string, string> = {
  DOCUMENTO_INVALIDO: "El documento de identidad no tiene un formato válido",
  DOCUMENTO_DUPLICADO: "El documento ya está registrado por otro usuario",
  VERIFICACION_FALLIDA: "No pudimos verificar tu identidad",
  OTRO: "Motivo no especificado",
};

const ESTADO_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "BORRADOR", label: "Borrador" },
  { value: "EN_REVISION", label: "En revisión" },
  { value: "ACREDITADO", label: "Acreditado" },
  { value: "RECHAZADO", label: "Rechazado" },
];

const MOTIVO_OPTIONS = [
  { value: "", label: "Selecciona un motivo…" },
  { value: "DOCUMENTO_INVALIDO", label: MOTIVO_RECHAZO_LABELS.DOCUMENTO_INVALIDO },
  { value: "DOCUMENTO_DUPLICADO", label: MOTIVO_RECHAZO_LABELS.DOCUMENTO_DUPLICADO },
  { value: "VERIFICACION_FALLIDA", label: MOTIVO_RECHAZO_LABELS.VERIFICACION_FALLIDA },
  { value: "OTRO", label: MOTIVO_RECHAZO_LABELS.OTRO },
];

export default function AdminAcreditaciones() {
  const api = useApi();
  const [items, setItems] = useState<AdminProponente[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [estado, setEstado] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingDecision, setPendingDecision] = useState<{ proponente: AdminProponente; decision: "APROBAR" | "RECHAZAR" } | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState<MotivoRechazo | "">("");
  const [processing, setProcessing] = useState(false);

  function load() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (estado) params.set("estado", estado);
    api
      .get(`/api/acreditacion?${params}`)
      .then((r) => {
        setItems(r.data.items);
        setTotal(r.data.total);
        setPages(r.data.pages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(load, [estado, page]);

  function openDecision(proponente: AdminProponente, decision: "APROBAR" | "RECHAZAR") {
    setMotivoRechazo("");
    setPendingDecision({ proponente, decision });
  }

  function closeDecision() {
    if (processing) return;
    setPendingDecision(null);
    setMotivoRechazo("");
  }

  async function confirmDecision() {
    if (!pendingDecision) return;
    if (pendingDecision.decision === "RECHAZAR" && !motivoRechazo) return;
    setProcessing(true);
    try {
      await api.patch(`/api/acreditacion/${pendingDecision.proponente._id}/revisar`, {
        decision: pendingDecision.decision,
        ...(pendingDecision.decision === "RECHAZAR" ? { motivoRechazo } : {}),
      });
    } catch (err) {
      console.error("Revisión de acreditación falló:", err);
    } finally {
      setPendingDecision(null);
      setMotivoRechazo("");
      load();
      setProcessing(false);
    }
  }

  const isReject = pendingDecision?.decision === "RECHAZAR";

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Gestión"
        title="Acreditaciones"
        subtitle={`${total} proponentes registrados`}
      />

      <Card padding="md" style={{ marginBottom: "var(--sp-4)" }}>
        <div style={{ width: 220 }}>
          <Select
            options={ESTADO_OPTIONS}
            value={estado}
            onChange={(e) => { setPage(1); setEstado(e.target.value); }}
          />
        </div>
      </Card>

      <Card padding="none">
        {loading && items.length === 0 ? (
          <LoadingState />
        ) : (
          <DataTable<AdminProponente>
            columns={[
              { header: "Proponente", accessor: (p) => (
                <div>
                  <p style={{ fontWeight: 600, color: "var(--text)", fontSize: "var(--t-sm)" }}>{p.userId?.name ?? "—"}</p>
                  <p style={{ color: "var(--text-soft)", fontSize: "10.5px" }}>{p.userId?.email ?? ""}</p>
                </div>
              ) },
              { header: "Documento", accessor: (p) => <span className="mono">{p.documento?.canonico ?? "—"}</span> },
              { header: "Estado", accessor: (p) => (
                <StatusBadge status={ACREDITACION_BADGE[p.estado].status} label={ACREDITACION_BADGE[p.estado].label} />
              ) },
              { header: "Fecha", accessor: (p) => (
                <span style={{ color: "var(--text-muted)", fontSize: "var(--t-xs)" }}>
                  {new Date(p.createdAt).toLocaleDateString("es-PA", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              ) },
              {
                header: "",
                align: "right",
                accessor: (p) =>
                  p.estado === "EN_REVISION" ? (
                    <div style={{ display: "flex", gap: "var(--sp-2)", justifyContent: "flex-end" }}>
                      <Button variant="ghost" size="sm" onClick={() => openDecision(p, "RECHAZAR")}>
                        Rechazar
                      </Button>
                      <Button variant="primary" size="sm" onClick={() => openDecision(p, "APROBAR")}>
                        Aprobar
                      </Button>
                    </div>
                  ) : null,
              },
            ]}
            data={items}
            emptyMessage="Sin proponentes que coincidan con el filtro"
            page={page}
            pages={pages}
            onPageChange={setPage}
          />
        )}
      </Card>

      {pendingDecision && (
        <div
          onClick={closeDecision}
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
              {isReject ? "¿Rechazar acreditación?" : "¿Aprobar acreditación?"}
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)", marginBottom: "var(--sp-4)" }}>
              {isReject
                ? `Se rechazará la acreditación de ${pendingDecision.proponente.userId?.email ?? "este proponente"}. Deberá corregir su documento y volver a enviarlo.`
                : `${pendingDecision.proponente.userId?.email ?? "Este proponente"} quedará acreditado y podrá pujar en subastas.`}
            </p>
            {isReject && (
              <div style={{ textAlign: "left", marginBottom: "var(--sp-5)" }}>
                <Select
                  label="Motivo del rechazo"
                  options={MOTIVO_OPTIONS}
                  value={motivoRechazo}
                  onChange={(e) => setMotivoRechazo(e.target.value as MotivoRechazo | "")}
                />
              </div>
            )}
            <div style={{ display: "flex", gap: "var(--sp-2)", justifyContent: "center" }}>
              <Button variant="ghost" onClick={closeDecision} disabled={processing}>Cancelar</Button>
              <Button
                variant={isReject ? "danger" : "primary"}
                onClick={confirmDecision}
                disabled={processing || (isReject && !motivoRechazo)}
              >
                {processing ? "Procesando..." : isReject ? "Confirmar rechazo" : "Confirmar aprobación"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
