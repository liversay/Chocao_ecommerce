// frontend/src/pages/admin/AdminAudit.tsx
import { useEffect, useState } from "react";
import { useApi } from "../../hooks/useApi";
import Card from "../../components/Card";
import Select from "../../components/Select";
import DataTable from "../../components/DataTable";
import PageHeader from "../../components/PageHeader";
import LoadingState from "../../components/LoadingState";
import ExportCsvButton from "../../components/admin/ExportCsvButton";

interface AuditEntry {
  _id: string;
  actor?: { name: string; email: string; role: string } | null;
  actorEmail?: string;
  action: string;
  resource: string;
  resourceId?: string;
  before?: unknown;
  after?: unknown;
  source: "api" | "mcp" | "job";
  createdAt: string;
}

const RESOURCE_OPTIONS = [
  { value: "", label: "Todos los recursos" },
  { value: "vehicle", label: "Vehículo" },
  { value: "payment", label: "Pago" },
  { value: "user", label: "Usuario" },
];

function summarize(value: unknown): string {
  if (value === undefined || value === null) return "—";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export default function AdminAudit() {
  const api = useApi();
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [resource, setResource] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "30" });
    if (resource) params.set("resource", resource);
    api
      .get(`/api/audit?${params}`)
      .then((r) => {
        setItems(r.data.items);
        setTotal(r.data.total);
        setPages(r.data.pages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [resource, page]);

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Análisis"
        title="Auditoría"
        subtitle={`${total} acciones registradas — registro de solo-anexado`}
        actions={
          <ExportCsvButton
            data={items}
            filename="auditoria"
            columns={[
              { header: "Fecha", accessor: (a) => new Date(a.createdAt).toISOString() },
              { header: "Actor", accessor: (a) => a.actor?.email ?? a.actorEmail ?? "sistema" },
              { header: "Acción", accessor: (a) => a.action },
              { header: "Recurso", accessor: (a) => `${a.resource}${a.resourceId ? `:${a.resourceId}` : ""}` },
              { header: "Origen", accessor: (a) => a.source },
            ]}
          />
        }
      />

      <Card padding="md" style={{ marginBottom: "var(--sp-4)", width: 260 }}>
        <Select options={RESOURCE_OPTIONS} value={resource} onChange={(e) => { setPage(1); setResource(e.target.value); }} />
      </Card>

      <Card padding="none">
        {loading && items.length === 0 ? (
          <LoadingState />
        ) : (
          <DataTable<AuditEntry>
            dense
            columns={[
              { header: "Fecha", accessor: (a) => (
                <span style={{ color: "var(--text-muted)", fontSize: "var(--t-xs)" }}>
                  {new Date(a.createdAt).toLocaleString("es-PA", { dateStyle: "short", timeStyle: "short" })}
                </span>
              ) },
              { header: "Actor", accessor: (a) => a.actor?.email ?? a.actorEmail ?? "sistema" },
              { header: "Acción", accessor: (a) => <span className="mono" style={{ fontSize: "var(--t-xs)" }}>{a.action}</span> },
              { header: "Recurso", accessor: (a) => `${a.resource}${a.resourceId ? ` · ${a.resourceId.slice(-6)}` : ""}` },
              {
                header: "Antes → Después",
                accessor: (a) => (
                  <span className="mono" style={{ fontSize: "10.5px", color: "var(--text-soft)" }}>
                    {summarize(a.before)} → {summarize(a.after)}
                  </span>
                ),
              },
              { header: "Origen", accessor: (a) => <span className="badge badge-draft">{a.source}</span> },
            ]}
            data={items}
            emptyMessage="Sin acciones registradas"
            page={page}
            pages={pages}
            onPageChange={setPage}
          />
        )}
      </Card>
    </div>
  );
}
