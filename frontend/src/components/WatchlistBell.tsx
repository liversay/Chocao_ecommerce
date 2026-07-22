import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { useRealtime } from "../context/RealtimeContext";

// Fallback si el stream SSE se cae — el evento "watchlist.updated" en vivo
// cubre el caso normal, incluso entre pestañas/dispositivos del mismo usuario.
const POLL_FALLBACK_MS = 120_000;

// Botón de acceso rápido a "Mi watchlist" en el navbar, junto a la campana
// de notificaciones. Muestra la cantidad de vehículos guardados.
export default function WatchlistBell() {
  const api = useApi();
  const navigate = useNavigate();
  const { subscribe } = useRealtime();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    function poll() {
      api
        .get("/api/watchlist")
        .then((r) => {
          if (!cancelled) setCount(r.data.length);
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

  useEffect(() => {
    return subscribe("watchlist.updated", (payload) => {
      setCount((c) => Math.max(0, c + (payload.action === "added" ? 1 : -1)));
    });
  }, [subscribe]);

  return (
    <button
      onClick={() => navigate("/watchlist")}
      aria-label="Mi watchlist"
      title="Mi watchlist"
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
        fontSize: "1.1rem",
      }}
    >
      ♥
      {count > 0 && (
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
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  );
}
