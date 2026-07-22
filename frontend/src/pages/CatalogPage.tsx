import { useEffect, useState } from "react";
import axios from "axios";
import { useRealtime } from "../context/RealtimeContext";
import VehicleCard from "../components/VehicleCard";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";
import Input from "../components/Input";
import Select from "../components/Select";
import Button from "../components/Button";
import type { Vehicle } from "../types";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const PAGE_SIZE = 12;

const FILTERS = [
  { value: "", label: "Todos" },
  { value: "active", label: "Activos" },
  { value: "published", label: "Publicados" },
  { value: "closed", label: "Cerrados" },
  { value: "awarded", label: "Adjudicados" },
];

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
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Búsqueda y filtros del lado del servidor (paginado e indexado), con
  // debounce para no disparar una request por tecla.
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (filter) params.set("status", filter);
      if (search.trim()) params.set("q", search.trim());
      params.set("page", String(page));
      params.set("limit", String(PAGE_SIZE));

      axios.get(`${BASE_URL}/api/vehicles?${params}`)
        .then((r) => setData(r.data))
        .catch(console.error)
        .finally(() => setLoading(false));
    }, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [filter, search, page]);

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

      <div style={{ display: "flex", gap: "var(--sp-4)", marginBottom: "var(--sp-5)" }}>
        <div style={{ flex: 1 }}>
          <Input
            type="text"
            placeholder="Buscar por marca o modelo..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div style={{ width: 200, flexShrink: 0 }}>
          <Select
            options={FILTERS}
            value={filter}
            onChange={(e) => { setFilter(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {loading ? (
        <LoadingState message="Cargando catálogo..." />
      ) : items.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="No hay vehículos disponibles"
          description={search ? `Sin resultados para "${search}"` : "Prueba cambiar el filtro de estado."}
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
