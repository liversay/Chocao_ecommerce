import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import Card from "../components/Card";
import Button from "../components/Button";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";
import StatusBadge from "../components/StatusBadge";
import type { Bid, Vehicle } from "../types";

const CAR_PLACEHOLDER = "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400&q=80";

export default function MyBidsPage() {
  const api = useApi();
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/bids/my")
      .then((r) => setBids(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleCheckout(bid: Bid) {
    try {
      const { data } = await api.post("/api/payments/create-checkout-session", { bidId: bid._id });
      window.location.href = data.url;
    } catch {
      alert("Error al iniciar el pago. Intenta nuevamente.");
    }
  }

  // Stats
  const totalBids = bids.length;
  const activeBids = bids.filter((b) => b.status === "active").length;
  const wonBids = bids.filter((b) => b.status === "winner" || b.status === "paid").length;

  function vehicleHref(bid: Bid) {
    const vehicle = bid.vehicleId as Vehicle;
    return `/vehicles/${typeof bid.vehicleId === "string" ? bid.vehicleId : vehicle?._id}`;
  }

  return (
    <div className="container fade-in" style={{ padding: "var(--sp-6) var(--sp-5)" }}>
      <PageHeader
        eyebrow="Mi cuenta"
        title="Mis subastas"
        subtitle="Historial completo de pujas y adjudicaciones"
      />

      <Card padding="md" style={{ marginBottom: "var(--sp-5)" }}>
        <div className="stat-strip">
          <div className="stat-strip-item">
            <p className="stat-strip-value">{totalBids}</p>
            <p className="stat-strip-label">Pujas totales</p>
          </div>
          <div className="stat-strip-item">
            <p className="stat-strip-value">{activeBids}</p>
            <p className="stat-strip-label">Activas</p>
          </div>
          <div className="stat-strip-item">
            <p className="stat-strip-value">{wonBids}</p>
            <p className="stat-strip-label">Ganadas</p>
          </div>
        </div>
      </Card>

      <Card padding="none">
        {loading ? (
          <LoadingState />
        ) : bids.length === 0 ? (
          <EmptyState
            icon="🏷️"
            title="Aún no has participado en subastas"
            description="Explora el catálogo y realiza tu primera puja en un vehículo activo."
            action={
              <Link to="/vehicles">
                <Button variant="primary">Ir al catálogo</Button>
              </Link>
            }
          />
        ) : (
          <DataTable<Bid>
            columns={[
              {
                header: "Vehículo",
                accessor: (bid) => {
                  const vehicle = bid.vehicleId as Vehicle;
                  const img = vehicle?.images?.[0] || CAR_PLACEHOLDER;
                  return (
                    <Link
                      to={vehicleHref(bid)}
                      style={{ display: "flex", alignItems: "center", gap: "10px" }}
                    >
                      <img
                        src={img}
                        alt={vehicle?.title || "Vehículo"}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: "var(--radius-sm)",
                          objectFit: "cover",
                          flexShrink: 0,
                          border: "1px solid var(--border)",
                        }}
                        onError={(e) => { (e.target as HTMLImageElement).src = CAR_PLACEHOLDER; }}
                      />
                      <span style={{ fontWeight: 600, color: "var(--text)", fontSize: "var(--t-sm)" }}>
                        {vehicle?.title || "Vehículo"}
                      </span>
                    </Link>
                  );
                },
              },
              {
                header: "Monto",
                align: "right",
                accessor: (bid) => (
                  <span className={`mono${bid.status === "winner" ? " price-accent" : ""}`} style={{ fontWeight: 700 }}>
                    ${bid.amount.toLocaleString()}
                  </span>
                ),
              },
              {
                header: "Estado",
                accessor: (bid) => <StatusBadge status={bid.status} />,
              },
              {
                header: "Fecha",
                accessor: (bid) => (
                  <span style={{ color: "var(--text-muted)", fontSize: "var(--t-xs)" }}>
                    {new Date(bid.createdAt).toLocaleDateString("es-PA", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                ),
              },
              {
                header: "Acción",
                align: "right",
                accessor: (bid) =>
                  bid.status === "winner" ? (
                    <Button variant="primary" size="sm" onClick={() => handleCheckout(bid)}>
                      Pagar ahora
                    </Button>
                  ) : null,
              },
            ]}
            data={bids}
            emptyMessage="No has realizado pujas"
          />
        )}
      </Card>
    </div>
  );
}
