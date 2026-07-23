import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { Heart } from "lucide-react";
import { useApi } from "../hooks/useApi";

interface Props {
  vehicleId: string;
  size?: "sm" | "md";
}

export default function WatchlistButton({ vehicleId, size = "md" }: Props) {
  const api = useApi();
  const [saved, setSaved] = useState(false);
  const [pulse, setPulse] = useState(0);
  const requestIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/api/watchlist")
      .then((r) => {
        if (cancelled) return;
        const items = r.data as { vehicleId: { _id: string } }[];
        setSaved(items.some((i) => i.vehicleId?._id === vehicleId));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  function toggle(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    // Optimista: refleja el cambio de inmediato y solo revierte si el request falla,
    // en vez de esperar el round-trip de red antes de animar/pintar el nuevo estado.
    const next = !saved;
    setSaved(next);
    setPulse((p) => p + 1);

    const myRequestId = ++requestIdRef.current;
    const request = next
      ? api.post(`/api/watchlist/${vehicleId}`)
      : api.delete(`/api/watchlist/${vehicleId}`);

    request.catch(() => {
      if (requestIdRef.current === myRequestId) setSaved(!next);
    });
  }

  const dim = size === "sm" ? 32 : 40;
  return (
    <button
      onClick={toggle}
      aria-label={saved ? "Quitar de mi watchlist" : "Guardar en mi watchlist"}
      title={saved ? "Quitar de mi watchlist" : "Guardar en mi watchlist"}
      className="watchlist-btn"
      style={{
        width: dim,
        height: dim,
        borderRadius: "50%",
        background: saved ? "var(--danger-soft)" : "var(--surface)",
        border: "1px solid var(--border)",
        color: saved ? "var(--danger)" : "var(--text-muted)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <span
        key={pulse}
        className={pulse > 0 ? "watchlist-btn-icon watchlist-btn-icon-pop" : "watchlist-btn-icon"}
        style={{ display: "inline-flex" }}
      >
        <Heart size={size === "sm" ? 16 : 18} fill={saved ? "currentColor" : "none"} />
      </span>
    </button>
  );
}
