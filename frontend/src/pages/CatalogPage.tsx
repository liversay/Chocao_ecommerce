import { useEffect, useState } from "react";
import axios from "axios";
import { useRealtime } from "../context/RealtimeContext";
import VehicleCard from "../components/VehicleCard";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";
import Input from "../components/Input";
import Button from "../components/Button";
import CatalogFilters from "../components/CatalogFilters";
import { EMPTY_INSTANT_FILTERS, EMPTY_RANGE_DRAFT, type InstantFilters, type RangeDraft } from "../types/catalogFilters";
import type { Vehicle } from "../types";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const PAGE_SIZE = 12;

// Campos de texto/número: comparten un único debounce de 300ms (igual que la
// búsqueda libre ya tenía) para no disparar una request por tecla.
interface TextFilters extends RangeDraft {
  search: string;
}

const EMPTY_TEXT_FILTERS: TextFilters = { search: "", ...EMPTY_RANGE_DRAFT };

function hasAnyTextFilter(f: TextFilters): boolean {
  return Object.values(f).some((v) => v.trim() !== "");
}

function hasAnyFilterActive(text: TextFilters, instant: InstantFilters): boolean {
  return (
    hasAnyTextFilter(text) ||
    instant.status.length > 0 ||
    instant.transmission.length > 0 ||
    instant.bodyStyle.length > 0 ||
    instant.brand.length > 0 ||
    instant.sort !== EMPTY_INSTANT_FILTERS.sort
  );
}

interface CatalogResponse {
  items: Vehicle[];
  total: number;
  page: number;
  pages: number;
}

export default function CatalogPage() {
  const { subscribe } = useRealtime();
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [textFilters, setTextFilters] = useState<TextFilters>(EMPTY_TEXT_FILTERS);
  const [appliedTextFilters, setAppliedTextFilters] = useState<TextFilters>(EMPTY_TEXT_FILTERS);
  const [instantFilters, setInstantFilters] = useState<InstantFilters>(EMPTY_INSTANT_FILTERS);
  const [page, setPage] = useState(1);

  function updateTextFilters(patch: Partial<TextFilters>) {
    setTextFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }

  function updateInstantFilters(patch: Partial<InstantFilters>) {
    setInstantFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }

  function clearFilters() {
    setTextFilters(EMPTY_TEXT_FILTERS);
    setInstantFilters(EMPTY_INSTANT_FILTERS);
    setPage(1);
  }

  // Búsqueda de texto y rangos numéricos comparten el mismo debounce de
  // 300ms que ya tenía la búsqueda libre, para no disparar una request por
  // tecla. Checkboxes y el selector de orden se aplican de inmediato.
  useEffect(() => {
    const timer = setTimeout(
      () => setAppliedTextFilters(textFilters),
      hasAnyTextFilter(textFilters) ? 300 : 0
    );
    return () => clearTimeout(timer);
  }, [textFilters]);

  // Fetch server-side: se dispara ante cualquier cambio de filtro ya
  // aplicado (debounced o instantáneo) o de página.
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (appliedTextFilters.search.trim()) params.set("q", appliedTextFilters.search.trim());
    if (appliedTextFilters.minPrice) params.set("minPrice", appliedTextFilters.minPrice);
    if (appliedTextFilters.maxPrice) params.set("maxPrice", appliedTextFilters.maxPrice);
    if (appliedTextFilters.minYear) params.set("minYear", appliedTextFilters.minYear);
    if (appliedTextFilters.maxYear) params.set("maxYear", appliedTextFilters.maxYear);
    if (appliedTextFilters.minMileage) params.set("minMileage", appliedTextFilters.minMileage);
    if (appliedTextFilters.maxMileage) params.set("maxMileage", appliedTextFilters.maxMileage);
    if (instantFilters.status.length > 0) params.set("status", instantFilters.status.join(","));
    if (instantFilters.transmission.length > 0) params.set("transmission", instantFilters.transmission.join(","));
    if (instantFilters.bodyStyle.length > 0) params.set("bodyStyle", instantFilters.bodyStyle.join(","));
    if (instantFilters.brand.length > 0) params.set("brand", instantFilters.brand.join(","));
    if (instantFilters.sort) params.set("sort", instantFilters.sort);
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));

    axios.get(`${BASE_URL}/api/vehicles?${params}`)
      .then((r) => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [appliedTextFilters, instantFilters, page]);

  // Precio/estado en vivo por tarjeta — sin re-fetch de la página completa.
  // No añade ni quita tarjetas si un vehículo deja de calzar con el filtro
  // actual; eso se corrige solo en el próximo cambio de filtro/página.
  useEffect(() => {
    const unsubBid = subscribe("bid.placed", (payload) => {
      setData((d) =>
        d
          ? {
              ...d,
              items: d.items.map((v) => (v._id === payload.vehicleId ? { ...v, currentPrice: payload.currentPrice } : v)),
            }
          : d
      );
    });
    const unsubStatus = subscribe("vehicle.status", (payload) => {
      setData((d) =>
        d
          ? {
              ...d,
              items: d.items.map((v) =>
                v._id === payload.vehicleId ? { ...v, status: payload.status as Vehicle["status"] } : v
              ),
            }
          : d
      );
    });
    return () => {
      unsubBid();
      unsubStatus();
    };
  }, [subscribe]);

  const items = data?.items ?? [];

  return (
    <div className="container fade-in" style={{ padding: "var(--sp-6) var(--sp-5)" }}>
      <PageHeader
        eyebrow="Catálogo"
        title="Vehículos en subasta"
        subtitle="Vehículos aprehendidos disponibles para subasta pública"
      />

      <div style={{ display: "flex", gap: "var(--sp-4)", marginBottom: "var(--sp-4)", alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <Input
            type="text"
            placeholder="Buscar por marca o modelo..."
            value={textFilters.search}
            onChange={(e) => updateTextFilters({ search: e.target.value })}
          />
        </div>
        {hasAnyFilterActive(textFilters, instantFilters) && (
          <Button variant="ghost" onClick={clearFilters}>
            Limpiar filtros
          </Button>
        )}
      </div>

      <CatalogFilters
        range={textFilters}
        onRangeChange={updateTextFilters}
        instant={instantFilters}
        onInstantChange={updateInstantFilters}
      />

      {loading ? (
        <LoadingState message="Cargando catálogo..." />
      ) : items.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="No hay vehículos disponibles"
          description={
            textFilters.search ? `Sin resultados para "${textFilters.search}"` : "Prueba ajustar los filtros."
          }
        />
      ) : (
        <>
          <p className="text-muted" style={{ fontSize: "var(--t-sm)", marginBottom: "var(--sp-4)" }}>
            Mostrando <strong style={{ color: "var(--text)" }}>{items.length}</strong> de{" "}
            <strong style={{ color: "var(--text)" }}>{data!.total}</strong> vehículo{data!.total !== 1 ? "s" : ""}
          </p>
          <div className="grid-cards">
            {items.map((v) => <VehicleCard key={v._id} vehicle={v} />)}
          </div>

          {data!.pages > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "var(--sp-4)",
                marginTop: "var(--sp-6)",
              }}
            >
              <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                ← Anterior
              </Button>
              <span className="text-muted" style={{ fontSize: "var(--t-sm)" }}>
                Página {data!.page} de {data!.pages}
              </span>
              <Button variant="ghost" disabled={page >= data!.pages} onClick={() => setPage((p) => p + 1)}>
                Siguiente →
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
