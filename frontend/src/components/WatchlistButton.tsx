import { useState } from "react";
import type { MouseEvent } from "react";
import { Heart } from "lucide-react";
import { useWatchlist } from "../context/WatchlistContext";

interface Props {
  vehicleId: string;
  size?: "sm" | "md";
}

export default function WatchlistButton({ vehicleId, size = "md" }: Props) {
  const { isSaved, toggle } = useWatchlist();
  const [pulse, setPulse] = useState(0);
  const saved = isSaved(vehicleId);

  function handleClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    toggle(vehicleId);
    setPulse((p) => p + 1);
  }

  const dim = size === "sm" ? 32 : 40;
  return (
    <button
      onClick={handleClick}
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
