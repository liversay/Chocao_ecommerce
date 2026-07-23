import Input from "../Input";
import Select from "../Select";
import FilterCheckboxGroup from "../FilterCheckboxGroup";
import { toggleValue } from "../../utils/toggleValue";
import FilterPanel from "./FilterPanel";
import { BRANDS } from "../../constants/brands";
import { ADMIN_VEHICLE_STATUS_OPTIONS } from "../../constants/vehicleStatus";
import type { AdminVehicleRangeDraft, AdminVehicleInstantFilters } from "../../types/adminVehicleFilters";
import { countActiveAdminVehicleFilters } from "../../utils/filterAdminVehicles";

// Panel de filtros de vehículos del backoffice — mismo diseño colapsable que
// CatalogFilters (catálogo público), adaptado para admin: incluye el estado
// "Borrador" y un rango de fecha de registro. Reutilizado en /admin/vehicles
// y /admin/reports.

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

interface Props {
  search: string;
  onSearchChange: (value: string) => void;
  range: AdminVehicleRangeDraft;
  onRangeChange: (patch: Partial<AdminVehicleRangeDraft>) => void;
  instant: AdminVehicleInstantFilters;
  onInstantChange: (patch: Partial<AdminVehicleInstantFilters>) => void;
}

export default function AdminVehicleFilters({ search, onSearchChange, range, onRangeChange, instant, onInstantChange }: Props) {
  return (
    <FilterPanel
      search={{ value: search, onChange: onSearchChange, placeholder: "Título, marca o modelo..." }}
      activeCount={countActiveAdminVehicleFilters(range, instant)}
    >
      <div className="grid-2" style={{ gap: "var(--sp-3)" }}>
        <div style={{ display: "flex", gap: "var(--sp-3)" }}>
          <Input label="Precio mín. (USD)" type="number" min={0} value={range.minPrice} onChange={(e) => onRangeChange({ minPrice: e.target.value })} />
          <Input label="Precio máx. (USD)" type="number" min={0} value={range.maxPrice} onChange={(e) => onRangeChange({ maxPrice: e.target.value })} />
        </div>
        <div style={{ display: "flex", gap: "var(--sp-3)" }}>
          <Input label="Año mín." type="number" value={range.minYear} onChange={(e) => onRangeChange({ minYear: e.target.value })} />
          <Input label="Año máx." type="number" value={range.maxYear} onChange={(e) => onRangeChange({ maxYear: e.target.value })} />
        </div>
        <div style={{ display: "flex", gap: "var(--sp-3)" }}>
          <Input label="Km mín." type="number" min={0} value={range.minMileage} onChange={(e) => onRangeChange({ minMileage: e.target.value })} />
          <Input label="Km máx." type="number" min={0} value={range.maxMileage} onChange={(e) => onRangeChange({ maxMileage: e.target.value })} />
        </div>
        <div style={{ display: "flex", gap: "var(--sp-3)" }}>
          <Input label="Registrado desde" type="date" value={range.dateFrom} onChange={(e) => onRangeChange({ dateFrom: e.target.value })} />
          <Input label="Registrado hasta" type="date" value={range.dateTo} onChange={(e) => onRangeChange({ dateTo: e.target.value })} />
        </div>
      </div>

      <div className="grid-2" style={{ gap: "var(--sp-3)" }}>
        <Select label="Ordenar por" options={SORT_OPTIONS} value={instant.sort} onChange={(e) => onInstantChange({ sort: e.target.value })} />
      </div>

      <div className="grid-2" style={{ gap: "var(--sp-4)" }}>
        <div>
          <span className="field-label">Transmisión</span>
          <FilterCheckboxGroup
            options={TRANSMISSION_OPTIONS}
            selected={instant.transmission}
            onToggle={(v) => onInstantChange({ transmission: toggleValue(instant.transmission, v) })}
          />
        </div>
        <div>
          <span className="field-label">Carrocería</span>
          <FilterCheckboxGroup
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
        <FilterCheckboxGroup
          options={ADMIN_VEHICLE_STATUS_OPTIONS}
          selected={instant.status}
          onToggle={(v) => onInstantChange({ status: toggleValue(instant.status, v) })}
        />
      </div>

      <div>
        <span className="field-label">Marca</span>
        <FilterCheckboxGroup
          options={BRAND_OPTIONS}
          selected={instant.brand}
          onToggle={(v) => onInstantChange({ brand: toggleValue(instant.brand, v) })}
          scroll
        />
      </div>
    </FilterPanel>
  );
}
