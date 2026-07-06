import { useEffect, useState } from "react";

interface Props {
  endDate: string | Date | null | undefined;
  variant?: "full" | "compact";
}

function getRemaining(end: Date | null) {
  if (!end) return null;
  const ms = end.getTime() - Date.now();
  if (ms <= 0) return { d: 0, h: 0, m: 0, s: 0, expired: true };
  return {
    d: Math.floor(ms / 86400000),
    h: Math.floor((ms % 86400000) / 3600000),
    m: Math.floor((ms % 3600000) / 60000),
    s: Math.floor((ms % 60000) / 1000),
    expired: false,
  };
}

export default function Countdown({ endDate, variant = "full" }: Props) {
  const end = endDate ? new Date(endDate) : null;
  const [remaining, setRemaining] = useState(() => getRemaining(end));

  useEffect(() => {
    if (!end) return;
    const interval = setInterval(() => setRemaining(getRemaining(end)), 1000);
    return () => clearInterval(interval);
  }, [endDate]);

  if (!end || !remaining) return null;

  if (remaining.expired) {
    return (
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        color: "var(--danger)",
        fontSize: variant === "compact" ? "var(--t-xs)" : "var(--t-sm)",
        fontWeight: 600,
      }}>
        ⏱ Subasta finalizada
      </span>
    );
  }

  if (variant === "compact") {
    const parts: string[] = [];
    if (remaining.d > 0) parts.push(`${remaining.d}d`);
    parts.push(`${String(remaining.h).padStart(2, "0")}h`);
    parts.push(`${String(remaining.m).padStart(2, "0")}m`);
    parts.push(`${String(remaining.s).padStart(2, "0")}s`);
    return (
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        color: "var(--text-muted)",
        fontSize: "var(--t-xs)",
        fontWeight: 600,
        fontFamily: "ui-monospace, monospace",
        letterSpacing: "0.02em",
      }}>
        ⏱ {parts.join(" ")}
      </span>
    );
  }

  const cells = [
    { value: remaining.d, label: "Días" },
    { value: remaining.h, label: "Horas" },
    { value: remaining.m, label: "Min" },
    { value: remaining.s, label: "Seg" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{
        fontSize: "var(--t-xs)",
        color: "var(--text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        fontWeight: 600,
        textAlign: "center",
      }}>
        ⏱ Tiempo restante
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
        {cells.map((c) => (
          <div
            key={c.label}
            style={{
              background: "var(--surface)",
              borderRadius: "var(--radius-sm)",
              boxShadow: "var(--nm-out-sm)",
              padding: "8px 4px",
              textAlign: "center",
            }}
          >
            <p style={{
              fontSize: "var(--t-lg)",
              fontWeight: 800,
              color: "var(--text)",
              letterSpacing: "-0.02em",
              lineHeight: 1,
              fontFamily: "ui-monospace, monospace",
            }}>
              {String(c.value).padStart(2, "0")}
            </p>
            <p style={{
              fontSize: "0.65rem",
              color: "var(--text-soft)",
              textTransform: "uppercase",
              fontWeight: 600,
              letterSpacing: "0.06em",
              marginTop: 4,
            }}>
              {c.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
