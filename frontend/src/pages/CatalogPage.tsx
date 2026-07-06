import { useEffect, useState } from "react";
import axios from "axios";
import VehicleCard from "../components/VehicleCard";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";
import Input from "../components/Input";
import Select from "../components/Select";
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

      <div style={{ display: "flex", gap: "var(--sp-4)", marginBottom: "var(--sp-5)" }}>
        <div style={{ flex: 1 }}>
          <Input
            type="text"
            placeholder="Buscar por marca o modelo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ width: 200, flexShrink: 0 }}>
          <Select
            options={FILTERS}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
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
          <p className="text-muted" style={{ fontSize: "var(--t-sm)", marginBottom: "var(--sp-4)" }}>
            Mostrando <strong style={{ color: "var(--text)" }}>{filtered.length}</strong> vehículo{filtered.length !== 1 ? "s" : ""}
          </p>
          <div className="grid-cards">
            {filtered.map((v) => <VehicleCard key={v._id} vehicle={v} />)}
          </div>
        </>
      )}
    </div>
  );
}
