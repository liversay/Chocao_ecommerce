import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { useApi } from "../hooks/useApi";
import VehicleCard from "../components/VehicleCard";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";
import Button from "../components/Button";
import type { WatchlistItem } from "../types";

export default function MyWatchlistPage() {
  const api = useApi();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/api/watchlist")
      .then((r) => setItems(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container fade-in" style={{ padding: "var(--sp-6) var(--sp-5)" }}>
      <PageHeader
        eyebrow="Mi cuenta"
        title="Mi watchlist"
        subtitle="Vehículos que sigues — te avisamos si te superan o si la subasta está por cerrar"
      />

      {loading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Heart size={32} strokeWidth={1.5} color="var(--text-muted)" />}
          title="Aún no sigues ningún vehículo"
          description="Guarda un vehículo desde el catálogo para hacerle seguimiento aquí."
          action={
            <Link to="/vehicles">
              <Button variant="primary">Ver catálogo</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid-cards">
          {items.map((item) => (
            <VehicleCard key={item._id} vehicle={item.vehicleId} />
          ))}
        </div>
      )}
    </div>
  );
}
