// frontend/src/pages/admin/AdminUsers.tsx
import { useEffect, useState } from "react";
import { useApi } from "../../hooks/useApi";
import { useRealtimeRefetch } from "../../hooks/useRealtimeRefetch";
import { usePersistedState } from "../../hooks/usePersistedState";
import Card from "../../components/Card";
import Button from "../../components/Button";
import Input from "../../components/Input";
import Select from "../../components/Select";
import DataTable from "../../components/DataTable";
import PageHeader from "../../components/PageHeader";
import LoadingState from "../../components/LoadingState";
import ExportCsvButton from "../../components/admin/ExportCsvButton";
import FilterPanel from "../../components/admin/FilterPanel";
import type { User } from "../../types";

interface AdminUser extends User {
  bidCount: number;
}

const ROLE_OPTIONS = [
  { value: "", label: "Todos los roles" },
  { value: "customer", label: "Ciudadano" },
  { value: "admin", label: "Administrador" },
];

const BANNED_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "false", label: "Activos" },
  { value: "true", label: "Baneados" },
];

interface DateRange {
  from: string;
  to: string;
}

const EMPTY_DATE_RANGE: DateRange = { from: "", to: "" };

export default function AdminUsers() {
  const api = useApi();
  const [items, setItems] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [q, setQ] = usePersistedState("chocao.admin.filters.users.q", "");
  const [role, setRole] = usePersistedState("chocao.admin.filters.users.role", "");
  const [banned, setBanned] = usePersistedState("chocao.admin.filters.users.banned", "");
  const [dateRange, setDateRange] = usePersistedState<DateRange>("chocao.admin.filters.users.dateRange", EMPTY_DATE_RANGE);
  const [loading, setLoading] = useState(true);
  const [pendingChange, setPendingChange] = useState<{ user: AdminUser; role: "customer" | "admin" } | null>(null);
  const [pendingBan, setPendingBan] = useState<{ user: AdminUser; banned: boolean } | null>(null);
  const [banning, setBanning] = useState(false);

  function load() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (q.trim()) params.set("q", q.trim());
    if (role) params.set("role", role);
    if (banned) params.set("banned", banned);
    if (dateRange.from) params.set("from", dateRange.from);
    if (dateRange.to) params.set("to", dateRange.to);
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
  }, [q, role, banned, dateRange.from, dateRange.to, page]);
  useRealtimeRefetch(["user.updated"], load);

  async function confirmRoleChange() {
    if (!pendingChange) return;
    try {
      await api.patch(`/api/users/${pendingChange.user._id}/role`, { role: pendingChange.role });
    } catch (error) {
      // El modal no debe quedarse colgado si el PATCH falla: se cierra y la
      // tabla se recarga, con lo que el select vuelve al rol real del servidor.
      console.error("Error al cambiar el rol:", error);
    } finally {
      setPendingChange(null);
      load();
    }
  }

  async function confirmBan() {
    if (!pendingBan) return;
    setBanning(true);
    try {
      await api.patch(`/api/users/${pendingBan.user._id}/ban`, { banned: pendingBan.banned });
    } catch (error) {
      console.error("Error al cambiar el estado de baneo:", error);
    } finally {
      setBanning(false);
      setPendingBan(null);
      load();
    }
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
              { header: "Baneado", accessor: (u) => (u.banned ? "Sí" : "No") },
              { header: "Fecha de creación", accessor: (u) => new Date(u.createdAt).toISOString() },
            ]}
          />
        }
      />

      <FilterPanel
        search={{ value: q, onChange: (v) => { setPage(1); setQ(v); }, placeholder: "Buscar por nombre o email..." }}
        activeCount={(role ? 1 : 0) + (banned ? 1 : 0) + (dateRange.from || dateRange.to ? 1 : 0)}
      >
        <div className="grid-2" style={{ gap: "var(--sp-3)" }}>
          <Select label="Rol" options={ROLE_OPTIONS} value={role} onChange={(e) => { setPage(1); setRole(e.target.value); }} />
          <Select label="Estado" options={BANNED_OPTIONS} value={banned} onChange={(e) => { setPage(1); setBanned(e.target.value); }} />
        </div>
        <div className="grid-2" style={{ gap: "var(--sp-3)" }}>
          <Input
            label="Creado desde"
            type="date"
            value={dateRange.from}
            onChange={(e) => { setPage(1); setDateRange((prev) => ({ ...prev, from: e.target.value })); }}
          />
          <Input
            label="Creado hasta"
            type="date"
            value={dateRange.to}
            onChange={(e) => { setPage(1); setDateRange((prev) => ({ ...prev, to: e.target.value })); }}
          />
        </div>
      </FilterPanel>

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
                header: "Fecha de creación",
                sortKey: "createdAt",
                sortValue: (u) => new Date(u.createdAt).getTime(),
                accessor: (u) => (
                  <span style={{ color: "var(--text-muted)", fontSize: "var(--t-xs)" }}>
                    {new Date(u.createdAt).toLocaleDateString("es-PA", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                ),
              },
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
              {
                header: "Estado",
                accessor: (u) => (
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 10px",
                      borderRadius: "var(--radius-pill)",
                      fontSize: "var(--t-xs)",
                      fontWeight: 600,
                      background: u.banned ? "var(--danger-soft)" : "var(--success-soft)",
                      color: u.banned ? "var(--danger)" : "var(--success)",
                    }}
                  >
                    {u.banned ? "Baneado" : "Activo"}
                  </span>
                ),
              },
              {
                header: "",
                align: "right",
                accessor: (u) => (
                  <Button
                    size="sm"
                    variant={u.banned ? "secondary" : "danger"}
                    onClick={() => setPendingBan({ user: u, banned: !u.banned })}
                  >
                    {u.banned ? "Desbanear" : "Banear"}
                  </Button>
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

      {pendingBan && (
        <div
          onClick={() => (banning ? undefined : setPendingBan(null))}
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
              {pendingBan.banned ? `¿Banear a ${pendingBan.user.name}?` : `¿Desbanear a ${pendingBan.user.name}?`}
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)", marginBottom: "var(--sp-5)" }}>
              {pendingBan.banned
                ? "No podrá pujar, comprar ni acceder a la plataforma. Recibirá una notificación del baneo. Esta acción queda registrada en auditoría."
                : "Recuperará acceso completo a la plataforma de inmediato. Esta acción queda registrada en auditoría."}
            </p>
            <div style={{ display: "flex", gap: "var(--sp-2)", justifyContent: "center" }}>
              <Button variant="ghost" onClick={() => setPendingBan(null)} disabled={banning}>Cancelar</Button>
              <Button variant={pendingBan.banned ? "danger" : "primary"} onClick={confirmBan} disabled={banning}>
                {banning ? "Procesando..." : "Confirmar"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
