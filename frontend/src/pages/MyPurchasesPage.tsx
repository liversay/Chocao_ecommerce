import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import GlassCard from "../components/GlassCard";
import GlassButton from "../components/GlassButton";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";
import type { Bid, Vehicle } from "../types";

const CAR_PLACEHOLDER = "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400&q=80";

export default function MyPurchasesPage() {
  const api = useApi();
  const [purchases, setPurchases] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/bids/my/purchases")
      .then((r) => setPurchases(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalSpent = purchases.reduce((sum, b) => sum + b.amount, 0);

  return (
    <div className="container fade-in" style={{ padding: "var(--sp-6) var(--sp-5)" }}>
      <PageHeader
        eyebrow="Mi cuenta"
        title="Autos comprados"
        subtitle="Vehículos adjudicados y pagados"
      />

      {/* Stats */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "var(--sp-3)",
        marginBottom: "var(--sp-5)",
      }}>
        <GlassCard padding="md">
          <p style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
            Total de compras
          </p>
          <p style={{ fontSize: "var(--t-2xl)", fontWeight: 800, color: "var(--accent)", letterSpacing: "-0.03em", marginTop: 4 }}>
            {purchases.length}
          </p>
        </GlassCard>
        <GlassCard padding="md">
          <p style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
            Monto invertido
          </p>
          <p style={{ fontSize: "var(--t-2xl)", fontWeight: 800, color: "var(--success)", letterSpacing: "-0.03em", marginTop: 4 }}>
            ${totalSpent.toLocaleString()}
          </p>
        </GlassCard>
      </div>

      {loading ? (
        <LoadingState />
      ) : purchases.length === 0 ? (
        <EmptyState
          icon="🚗"
          title="Aún no has comprado vehículos"
          description="Cuando ganes una subasta y completes el pago, tus vehículos aparecerán aquí."
          action={
            <Link to="/vehicles">
              <GlassButton variant="primary">Ver subastas activas</GlassButton>
            </Link>
          }
        />
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "var(--sp-4)",
        }}>
          {purchases.map((bid) => {
            const vehicle = bid.vehicleId as Vehicle;
            const img = vehicle?.images?.[0] || CAR_PLACEHOLDER;

            return (
              <GlassCard key={bid._id} padding="none" style={{ overflow: "hidden" }}>
                <div style={{
                  height: 180,
                  background: "var(--bg-deep)",
                  position: "relative",
                  overflow: "hidden",
                  margin: "10px 10px 0",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "var(--nm-in-sm)",
                }}>
                  <img
                    src={img}
                    alt={vehicle?.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => { (e.target as HTMLImageElement).src = CAR_PLACEHOLDER; }}
                  />
                  <div style={{
                    position: "absolute",
                    top: 12, right: 12,
                    background: "var(--success)",
                    color: "white",
                    padding: "4px 12px",
                    borderRadius: "var(--radius-pill)",
                    fontSize: "var(--t-xs)",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    boxShadow: "var(--nm-out-sm)",
                  }}>
                    ✓ Pagado
                  </div>
                </div>

                <div style={{ padding: "var(--sp-4) var(--sp-5) var(--sp-5)" }}>
                  <p style={{
                    fontSize: "var(--t-xs)",
                    color: "var(--text-soft)",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: 4,
                  }}>
                    {vehicle?.brand} · {vehicle?.year}
                  </p>
                  <h3 style={{
                    fontSize: "var(--t-md)",
                    fontWeight: 700,
                    color: "var(--text)",
                    marginBottom: "var(--sp-3)",
                    lineHeight: 1.3,
                  }}>
                    {vehicle?.title}
                  </h3>

                  <div style={{
                    padding: "var(--sp-3)",
                    background: "var(--surface)",
                    boxShadow: "var(--nm-in-sm)",
                    borderRadius: "var(--radius-md)",
                    marginBottom: "var(--sp-3)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)" }}>Precio pagado</span>
                      <span style={{ fontSize: "var(--t-md)", fontWeight: 700, color: "var(--accent)" }}>
                        ${bid.amount.toLocaleString()}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)" }}>Fecha compra</span>
                      <span style={{ fontSize: "var(--t-xs)", color: "var(--text)", fontWeight: 600 }}>
                        {new Date(bid.createdAt).toLocaleDateString("es-PA", { day: "numeric", month: "long", year: "numeric" })}
                      </span>
                    </div>
                  </div>

                  <Link to={`/vehicles/${typeof bid.vehicleId === "string" ? bid.vehicleId : vehicle?._id}`}>
                    <GlassButton variant="ghost" size="sm" fullWidth>Ver detalle del vehículo</GlassButton>
                  </Link>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
