// frontend/src/pages/admin/AdminUsers.tsx
import { useEffect, useState } from "react";
import { useApi } from "../../hooks/useApi";
import Card from "../../components/Card";
import Button from "../../components/Button";
import Input from "../../components/Input";
import Select from "../../components/Select";
import DataTable from "../../components/DataTable";
import PageHeader from "../../components/PageHeader";
import LoadingState from "../../components/LoadingState";
import ExportCsvButton from "../../components/admin/ExportCsvButton";
import type { User } from "../../types";

interface AdminUser extends User {
  bidCount: number;
}

const ROLE_OPTIONS = [
  { value: "", label: "Todos los roles" },
  { value: "customer", label: "Ciudadano" },
  { value: "admin", label: "Administrador" },
];

export default function AdminUsers() {
  const api = useApi();
  const [items, setItems] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingChange, setPendingChange] = useState<{ user: AdminUser; role: "customer" | "admin" } | null>(null);

  function load() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (q.trim()) params.set("q", q.trim());
    if (role) params.set("role", role);
    api
      .get(`/api/users?${params}`)
      .then((r) => {
        setItems(r.data.items);
        setTotal(r.data.total);
        setPages(r.data.pages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timer = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [q, role, page]);

  async function confirmRoleChange() {
    if (!pendingChange) return;
    await api.patch(`/api/users/${pendingChange.user._id}/role`, { role: pendingChange.role });
    setPendingChange(null);
    load();
  }

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Gestión"
        title="Usuarios"
        subtitle={`${total} usuarios registrados`}
        actions={
          <ExportCsvButton
            data={items}
            filename="usuarios"
            columns={[
              { header: "Nombre", accessor: (u) => u.name },
              { header: "Email", accessor: (u) => u.email },
              { header: "Rol", accessor: (u) => u.role },
              { header: "Pujas", accessor: (u) => u.bidCount },
            ]}
          />
        }
      />

      <Card padding="md" style={{ marginBottom: "var(--sp-4)", display: "flex", gap: "var(--sp-3)" }}>
        <div style={{ flex: 1 }}>
          <Input placeholder="Buscar por nombre o email..." value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
        </div>
        <div style={{ width: 220 }}>
          <Select options={ROLE_OPTIONS} value={role} onChange={(e) => { setPage(1); setRole(e.target.value); }} />
        </div>
      </Card>

      <Card padding="none">
        {loading && items.length === 0 ? (
          <LoadingState />
        ) : (
          <DataTable<AdminUser>
            columns={[
              { header: "Nombre", sortKey: "name", sortValue: (u) => u.name, accessor: (u) => (
                <span style={{ fontWeight: 600, color: "var(--text)" }}>{u.name}</span>
              ) },
              { header: "Email", sortKey: "email", sortValue: (u) => u.email, accessor: (u) => (
                <span style={{ color: "var(--text-muted)", fontSize: "var(--t-xs)" }}>{u.email}</span>
              ) },
              { header: "Pujas", align: "right", sortKey: "bidCount", sortValue: (u) => u.bidCount, accessor: (u) => (
                <span className="mono">{u.bidCount}</span>
              ) },
              {
                header: "Rol",
                accessor: (u) => (
                  <select
                    className="select"
                    value={u.role}
                    onChange={(e) => setPendingChange({ user: u, role: e.target.value as "customer" | "admin" })}
                    style={{ width: 160 }}
                  >
                    <option value="customer">Ciudadano</option>
                    <option value="admin">Administrador</option>
                  </select>
                ),
              },
            ]}
            data={items}
            emptyMessage="Sin usuarios que coincidan con el filtro"
            page={page}
            pages={pages}
            onPageChange={setPage}
          />
        )}
      </Card>

      {pendingChange && (
        <div
          onClick={() => setPendingChange(null)}
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
              ¿Cambiar rol de {pendingChange.user.name}?
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)", marginBottom: "var(--sp-5)" }}>
              Pasará de <strong>{pendingChange.user.role}</strong> a <strong>{pendingChange.role}</strong>. Esta acción queda registrada en auditoría.
            </p>
            <div style={{ display: "flex", gap: "var(--sp-2)", justifyContent: "center" }}>
              <Button variant="ghost" onClick={() => setPendingChange(null)}>Cancelar</Button>
              <Button variant="primary" onClick={confirmRoleChange}>Confirmar</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
