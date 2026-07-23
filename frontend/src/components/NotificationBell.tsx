import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { useRealtime } from "../context/RealtimeContext";
import type { AppNotification } from "../types";

// Fallback si el stream SSE se cae y tarda en reconectar — el evento
// "notification" en vivo ya cubre el caso normal (ver useRealtime().subscribe).
const POLL_FALLBACK_MS = 120_000;

const TYPE_ICON: Record<AppNotification["type"], string> = {
  outbid: "⚠",
  won: "🏆",
  payment_confirmed: "✓",
  refunded: "↺",
  watch_closing: "⏱",
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

export default function NotificationBell() {
  const api = useApi();
  const navigate = useNavigate();
  const { unreadCount, subscribe } = useRealtime();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    function poll() {
      api
        .get("/api/notifications/unread-count")
        .then((r) => {
          if (!cancelled) setUnread(r.data.count);
        })
        .catch(() => {});
    }
    poll();
    const id = setInterval(poll, POLL_FALLBACK_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Cada conexión/reconexión SSE manda un snapshot fresco de no-leídas —
  // resincroniza si el poll de arriba se perdió algo mientras el stream caía.
  useEffect(() => {
    setUnread(unreadCount);
  }, [unreadCount]);

  useEffect(() => {
    return subscribe("notification", (payload) => {
      setUnread((u) => u + 1);
      setItems((prev) =>
        [
          {
            _id: payload.id,
            type: payload.type,
            title: payload.title,
            body: payload.body,
            data: payload.data,
            read: false,
            createdAt: payload.createdAt,
          },
          ...prev,
        ].slice(0, 5)
      );
    });
  }, [subscribe]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function loadLatest() {
    api
      .get("/api/notifications?limit=5")
      .then((r) => setItems(r.data.items))
      .catch(() => {});
  }

  function toggle() {
    if (!open) loadLatest();
    setOpen((o) => !o);
  }

  function handleItemClick(n: AppNotification) {
    setOpen(false);
    if (!n.read) {
      api.patch(`/api/notifications/${n._id}/read`).catch(() => {});
      setUnread((u) => Math.max(0, u - 1));
    }
    if (n.data?.vehicleId) navigate(`/vehicles/${n.data.vehicleId}`);
    else navigate("/notifications");
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={toggle}
        aria-label="Notificaciones"
        style={{
          position: "relative",
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Bell size={20} />
        {unread > 0 && (
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              minWidth: 18,
              height: 18,
              borderRadius: "var(--radius-pill)",
              background: "var(--danger)",
              color: "#fff",
              fontSize: "10px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
            }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="card card-elevated"
          style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 340, zIndex: 200 }}
        >
          <div
            style={{
              padding: "var(--sp-3) var(--sp-4)",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <p style={{ fontSize: "var(--t-sm)", fontWeight: 700, color: "var(--text)" }}>Notificaciones</p>
            <button
              onClick={() => {
                api.patch("/api/notifications/read-all").catch(() => {});
                setUnread(0);
                setItems((prev) => prev.map((n) => ({ ...n, read: true })));
              }}
              style={{ fontSize: "var(--t-xs)", color: "var(--primary)", fontWeight: 600 }}
            >
              Marcar todas
            </button>
          </div>

          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {items.length === 0 ? (
              <p style={{ padding: "var(--sp-5)", textAlign: "center", color: "var(--text-soft)", fontSize: "var(--t-sm)" }}>
                Sin notificaciones
              </p>
            ) : (
              items.map((n) => (
                <button
                  key={n._id}
                  onClick={() => handleItemClick(n)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "var(--sp-3) var(--sp-4)",
                    borderBottom: "1px solid var(--hairline)",
                    background: n.read ? "transparent" : "var(--primary-soft)",
                    display: "flex",
                    gap: "var(--sp-3)",
                  }}
                >
                  <span style={{ fontSize: "1rem" }}>{TYPE_ICON[n.type]}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "var(--t-sm)", fontWeight: 600, color: "var(--text)" }}>{n.title}</p>
                    <p style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)", marginTop: 2 }}>{n.body}</p>
                    <p style={{ fontSize: "10px", color: "var(--text-soft)", marginTop: 4 }}>{timeAgo(n.createdAt)}</p>
                  </span>
                </button>
              ))
            )}
          </div>

          <button
            onClick={() => {
              setOpen(false);
              navigate("/notifications");
            }}
            style={{
              width: "100%",
              textAlign: "center",
              padding: "var(--sp-3)",
              fontSize: "var(--t-xs)",
              fontWeight: 600,
              color: "var(--primary)",
            }}
          >
            Ver todas →
          </button>
        </div>
      )}
    </div>
  );
}
