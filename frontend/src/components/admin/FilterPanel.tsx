import { useState } from "react";
import { ChevronDown, SlidersHorizontal, Search } from "lucide-react";
import Card from "../Card";

// Shell colapsable de filtros para el backoffice — mismo patrón visual que
// CatalogFilters (catálogo público): Card + header con SlidersHorizontal,
// chevron animado y `aria-expanded`. La barra de búsqueda, si se pasa, queda
// siempre visible en la cabecera (fuera del cuerpo colapsable).
interface Props {
  children: React.ReactNode;
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  defaultOpen?: boolean;
  /** Número de filtros activos (fuera de la búsqueda), mostrado como badge. */
  activeCount?: number;
}

export default function FilterPanel({ children, search, defaultOpen = false, activeCount = 0 }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card padding="md" style={{ marginBottom: "var(--sp-4)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
        {search && (
          <div style={{ position: "relative", flex: 1 }}>
            <Search
              size={16}
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-soft)" }}
            />
            <input
              type="text"
              className="input"
              placeholder={search.placeholder || "Buscar..."}
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              style={{ paddingLeft: 36, width: "100%" }}
            />
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--sp-2)",
            fontWeight: 600,
            color: "var(--text)",
            fontSize: "var(--t-sm)",
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            padding: "8px 14px",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <SlidersHorizontal size={16} />
          Filtros
          {activeCount > 0 && (
            <span
              style={{
                background: "var(--primary)",
                color: "var(--text-inverse)",
                borderRadius: "var(--radius-pill)",
                fontSize: "var(--t-xs)",
                fontWeight: 700,
                padding: "1px 7px",
                lineHeight: 1.5,
              }}
            >
              {activeCount}
            </span>
          )}
          <ChevronDown
            size={18}
            style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform var(--dur-fast)" }}
          />
        </button>
      </div>

      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)", marginTop: "var(--sp-4)" }}>
          {children}
        </div>
      )}
    </Card>
  );
}
