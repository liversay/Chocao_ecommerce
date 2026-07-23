import { useEffect, useState } from "react";
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
  const [loading, setLoading] = useState(false);

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

  async function toggle(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      if (saved) {
        await api.delete(`/api/watchlist/${vehicleId}`);
        setSaved(false);
      } else {
        await api.post(`/api/watchlist/${vehicleId}`);
        setSaved(true);
      }
    } catch {
      // deja el estado como estaba ante un error de red
    } finally {
      setLoading(false);
    }
  }

  const dim = size === "sm" ? 32 : 40;
  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-label={saved ? "Quitar de mi watchlist" : "Guardar en mi watchlist"}
      title={saved ? "Quitar de mi watchlist" : "Guardar en mi watchlist"}
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
      <Heart size={size === "sm" ? 16 : 18} fill={saved ? "currentColor" : "none"} />
    </button>
  );
}
