import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import Card from "../components/Card";
import Button from "../components/Button";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";
import type { AppNotification } from "../types";

const TYPE_ICON: Record<AppNotification["type"], string> = {
  outbid: "⚠",
  won: "🏆",
  payment_confirmed: "✓",
  refunded: "↺",
  watch_closing: "⏱",
};

export default function NotificationsPage() {
  const api = useApi();
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  function load(p: number) {
    setLoading(true);
    api
      .get(`/api/notifications?page=${p}&limit=20`)
      .then((r) => {
        setItems(r.data.items);
        setPages(r.data.pages);
        setPage(r.data.page);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => load(1), []);

  function handleClick(n: AppNotification) {
    if (!n.read) api.patch(`/api/notifications/${n._id}/read`).catch(() => {});
    if (n.data?.vehicleId) navigate(`/vehicles/${n.data.vehicleId}`);
  }

  return (
    <div className="container fade-in" style={{ padding: "var(--sp-6) var(--sp-5)" }}>
      <PageHeader
        eyebrow="Mi cuenta"
        title="Notificaciones"
        subtitle="Pujas superadas, adjudicaciones, pagos y avisos de tu watchlist"
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              api.patch("/api/notifications/read-all").catch(() => {});
              setItems((prev) => prev.map((n) => ({ ...n, read: true })));
            }}
          >
            Marcar todas como leídas
          </Button>
        }
      />

      <Card padding="none">
        {loading ? (
          <LoadingState />
        ) : items.length === 0 ? (
          <EmptyState icon="🔔" title="Sin notificaciones" description="Aquí verás avisos de tus subastas y compras." />
        ) : (
          <div>
            {items.map((n) => (
              <button
                key={n._id}
                onClick={() => handleClick(n)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "var(--sp-4) var(--sp-5)",
                  borderBottom: "1px solid var(--hairline)",
                  background: n.read ? "transparent" : "var(--primary-soft)",
                  display: "flex",
                  gap: "var(--sp-4)",
                }}
              >
                <span style={{ fontSize: "1.2rem" }}>{TYPE_ICON[n.type]}</span>
                <span style={{ flex: 1 }}>
                  <p style={{ fontSize: "var(--t-sm)", fontWeight: 600, color: "var(--text)" }}>{n.title}</p>
                  <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", marginTop: 4 }}>{n.body}</p>
                  <p style={{ fontSize: "var(--t-xs)", color: "var(--text-soft)", marginTop: 6 }}>
                    {new Date(n.createdAt).toLocaleString("es-PA")}
                  </p>
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {pages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: "var(--sp-3)", marginTop: "var(--sp-5)" }}>
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => load(page - 1)}>
            ← Anterior
          </Button>
          <span style={{ alignSelf: "center", fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
            Página {page} de {pages}
          </span>
          <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => load(page + 1)}>
            Siguiente →
          </Button>
        </div>
      )}
    </div>
  );
}
