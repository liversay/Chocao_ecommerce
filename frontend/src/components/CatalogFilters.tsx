import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import Card from "./Card";
import Input from "./Input";
import Select from "./Select";
import { BRANDS } from "../constants/brands";
import type { RangeDraft, InstantFilters } from "../types/catalogFilters";

// Mismos valores/labels que backend/src/models/Vehicle.ts y
// frontend/src/pages/admin/AdminVehicles.tsx (TRANSMISSIONS/BODY_STYLES) —
// reutilizamos el texto para consistencia visual entre catálogo y admin.
const STATUS_OPTIONS = [
  { value: "active", label: "Activos" },
  { value: "published", label: "Publicados" },
  { value: "closed", label: "Cerrados" },
  { value: "awarded", label: "Adjudicados" },
];

const TRANSMISSION_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "automatic", label: "Automático" },
];

const BODY_STYLE_OPTIONS = [
  { value: "sedan", label: "Sedán" },
  { value: "suv", label: "SUV" },
  { value: "pickup", label: "Pickup" },
  { value: "van", label: "Bus / Coaster / Van" },
  { value: "panel", label: "Panel" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Más reciente" },
  { value: "oldest", label: "Más antiguo" },
  { value: "price_desc", label: "Mayor precio" },
  { value: "price_asc", label: "Menor precio" },
];

const BRAND_OPTIONS = BRANDS.map((b) => ({ value: b, label: b }));

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

interface CheckboxGroupProps {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  scroll?: boolean;
}

function CheckboxGroup({ options, selected, onToggle, scroll }: CheckboxGroupProps) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--sp-2) var(--sp-3)",
        marginTop: 6,
        ...(scroll
          ? {
              maxHeight: 160,
              overflowY: "auto",
              padding: "var(--sp-2) var(--sp-3)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
            }
          : {}),
      }}
    >
      {options.map((o) => (
        <label
          key={o.value}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: "var(--t-sm)",
            color: "var(--text)",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          <input type="checkbox" checked={selected.includes(o.value)} onChange={() => onToggle(o.value)} />
          {o.label}
        </label>
      ))}
    </div>
  );
}

interface Props {
  range: RangeDraft;
  onRangeChange: (patch: Partial<RangeDraft>) => void;
  instant: InstantFilters;
  onInstantChange: (patch: Partial<InstantFilters>) => void;
}

export default function CatalogFilters({ range, onRangeChange, instant, onInstantChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Card padding="md" style={{ marginBottom: "var(--sp-5)" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", fontWeight: 600, color: "var(--text)", fontSize: "var(--t-sm)" }}>
          <SlidersHorizontal size={16} />
          Filtros
        </span>
        <ChevronDown
          size={18}
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform var(--dur-fast)" }}
        />
      </button>

      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)", marginTop: "var(--sp-4)" }}>
          <div className="grid-2" style={{ gap: "var(--sp-3)" }}>
            <div style={{ display: "flex", gap: "var(--sp-3)" }}>
              <Input
                label="Precio mín. (USD)"
                type="number"
                min={0}
                value={range.minPrice}
                onChange={(e) => onRangeChange({ minPrice: e.target.value })}
              />
              <Input
                label="Precio máx. (USD)"
                type="number"
                min={0}
                value={range.maxPrice}
                onChange={(e) => onRangeChange({ maxPrice: e.target.value })}
              />
            </div>
            <div style={{ display: "flex", gap: "var(--sp-3)" }}>
              <Input
                label="Año mín."
                type="number"
                value={range.minYear}
                onChange={(e) => onRangeChange({ minYear: e.target.value })}
              />
              <Input
                label="Año máx."
                type="number"
                value={range.maxYear}
                onChange={(e) => onRangeChange({ maxYear: e.target.value })}
              />
            </div>
            <div style={{ display: "flex", gap: "var(--sp-3)" }}>
              <Input
                label="Km mín."
                type="number"
                min={0}
                value={range.minMileage}
                onChange={(e) => onRangeChange({ minMileage: e.target.value })}
              />
              <Input
                label="Km máx."
                type="number"
                min={0}
                value={range.maxMileage}
                onChange={(e) => onRangeChange({ maxMileage: e.target.value })}
              />
            </div>
            <Select
              label="Ordenar por"
              options={SORT_OPTIONS}
              value={instant.sort}
              onChange={(e) => onInstantChange({ sort: e.target.value })}
            />
          </div>

          <div className="grid-2" style={{ gap: "var(--sp-4)" }}>
            <div>
              <span className="field-label">Transmisión</span>
              <CheckboxGroup
                options={TRANSMISSION_OPTIONS}
                selected={instant.transmission}
                onToggle={(v) => onInstantChange({ transmission: toggleValue(instant.transmission, v) })}
              />
            </div>
            <div>
              <span className="field-label">Carrocería</span>
              <CheckboxGroup
                options={BODY_STYLE_OPTIONS}
                selected={instant.bodyStyle}
                onToggle={(v) => onInstantChange({ bodyStyle: toggleValue(instant.bodyStyle, v) })}
              />
            </div>
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span className="field-label">Estado</span>
              {instant.status.length === 0 && (
                <span className="text-muted" style={{ fontSize: "var(--t-xs)" }}>
                  Todos (sin filtrar)
                </span>
              )}
            </div>
            <CheckboxGroup
              options={STATUS_OPTIONS}
              selected={instant.status}
              onToggle={(v) => onInstantChange({ status: toggleValue(instant.status, v) })}
            />
          </div>

          <div>
            <span className="field-label">Marca</span>
            <CheckboxGroup
              options={BRAND_OPTIONS}
              selected={instant.brand}
              onToggle={(v) => onInstantChange({ brand: toggleValue(instant.brand, v) })}
              scroll
            />
          </div>
        </div>
      )}
    </Card>
  );
}
