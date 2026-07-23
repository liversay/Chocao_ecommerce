import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Car } from "lucide-react";
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

export default function MyPurchasesPage() {
  const api = useApi();
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/bids/my/purchases")
      .then((r) => setPurchases(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalSpent = purchases.reduce((sum, b) => sum + b.amount, 0);

  function vehicleHref(bid: Bid) {
    const vehicle = bid.vehicleId as Vehicle;
    return `/vehicles/${typeof bid.vehicleId === "string" ? bid.vehicleId : vehicle?._id}`;
  }

  return (
    <div className="container fade-in" style={{ padding: "var(--sp-6) var(--sp-5)" }}>
      <PageHeader
        eyebrow="Mi cuenta"
        title="Autos comprados"
        subtitle="Vehículos adjudicados y pagados"
      />

      <Card padding="md" style={{ marginBottom: "var(--sp-5)" }}>
        <div className="stat-strip">
          <div className="stat-strip-item">
            <p className="stat-strip-value">{purchases.length}</p>
            <p className="stat-strip-label">Total de compras</p>
          </div>
          <div className="stat-strip-item">
            <p className="stat-strip-value">${totalSpent.toLocaleString()}</p>
            <p className="stat-strip-label">Monto invertido</p>
          </div>
        </div>
      </Card>

      <Card padding="none">
        {loading ? (
          <LoadingState />
        ) : purchases.length === 0 ? (
          <EmptyState
            icon={<Car size={32} strokeWidth={1.5} color="var(--text-muted)" />}
            title="Aún no has comprado vehículos"
            description="Cuando ganes una subasta y completes el pago, tus vehículos aparecerán aquí."
            action={
              <Link to="/vehicles">
                <Button variant="primary">Ver subastas activas</Button>
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
                header: "Monto pagado",
                align: "right",
                accessor: (bid) => (
                  <span className="mono price-accent" style={{ fontWeight: 700 }}>
                    ${bid.amount.toLocaleString()}
                  </span>
                ),
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
                header: "Estado",
                accessor: () => <StatusBadge status="paid" />,
              },
              {
                header: "",
                align: "right",
                accessor: (bid) =>
                  bid.payment ? (
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/receipt/${bid.payment!.id}`)}>
                      Ver recibo
                    </Button>
                  ) : null,
              },
            ]}
            data={purchases}
            emptyMessage="No hay compras registradas"
          />
        )}
      </Card>
    </div>
  );
}
