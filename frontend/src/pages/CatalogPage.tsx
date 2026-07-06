import { useEffect, useState } from "react";
import axios from "axios";
import VehicleCard from "../components/VehicleCard";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";
import type { Vehicle } from "../types";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const FILTERS = [
  { value: "", label: "Todos" },
  { value: "active", label: "Activos" },
  { value: "published", label: "Publicados" },
  { value: "closed", label: "Cerrados" },
  { value: "awarded", label: "Adjudicados" },
];

export default function CatalogPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = filter ? `?status=${filter}` : "";
    axios.get(`${BASE_URL}/api/vehicles${params}`)
      .then((r) => setVehicles(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filter]);

  const filtered = vehicles.filter((v) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      v.title.toLowerCase().includes(q) ||
      v.brand.toLowerCase().includes(q) ||
      v.model.toLowerCase().includes(q)
    );
  });

  return (
    <div className="container fade-in" style={{ padding: "var(--sp-6) var(--sp-5)" }}>
      <PageHeader
        eyebrow="Catálogo"
        title="Vehículos en subasta"
        subtitle="Vehículos aprehendidos disponibles para subasta pública"
      />

      {/* Filter bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--sp-4)",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--sp-5)",
          padding: "var(--sp-3) var(--sp-4)",
          background: "var(--surface)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--nm-out-sm)",
        }}
      >
        <div style={{
          display: "flex",
          gap: "4px",
          background: "var(--surface)",
          padding: "5px",
          borderRadius: "var(--radius-pill)",
          boxShadow: "var(--nm-in-sm)",
        }}>
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              style={{
                padding: "8px 16px",
                borderRadius: "var(--radius-pill)",
                fontSize: "var(--t-xs)",
                fontWeight: 600,
                color: filter === f.value ? "var(--primary)" : "var(--text-muted)",
                background: filter === f.value ? "var(--surface)" : "transparent",
                boxShadow: filter === f.value ? "var(--nm-out-sm)" : "none",
                transition: "all 0.15s",
                border: "none",
                cursor: "pointer",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ flex: "1 1 240px", minWidth: 200, maxWidth: 320 }}>
          <input
            type="text"
            placeholder="🔍 Buscar por marca o modelo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              background: "var(--surface)",
              boxShadow: "var(--nm-in-sm)",
              borderRadius: "var(--radius-pill)",
              border: "none",
              padding: "10px 18px",
              width: "100%",
              fontSize: "var(--t-sm)",
              color: "var(--text)",
            }}
          />
        </div>
      </div>

      {loading ? (
        <LoadingState message="Cargando catálogo..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="No hay vehículos disponibles"
          description={search ? `Sin resultados para "${search}"` : "Prueba cambiar el filtro de estado."}
        />
      ) : (
        <>
          <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)", marginBottom: "var(--sp-4)" }}>
            Mostrando <strong style={{ color: "var(--text)" }}>{filtered.length}</strong> vehículo{filtered.length !== 1 ? "s" : ""}
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "var(--sp-4)",
            }}
          >
            {filtered.map((v) => <VehicleCard key={v._id} vehicle={v} />)}
          </div>
        </>
      )}
    </div>
  );
}
