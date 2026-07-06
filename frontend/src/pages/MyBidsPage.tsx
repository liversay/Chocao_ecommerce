import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import GlassCard from "../components/GlassCard";
import GlassButton from "../components/GlassButton";
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
  const winning = bids.filter((b) => b.status === "active").length;
  const won = bids.filter((b) => b.status === "winner" || b.status === "paid").length;

  return (
    <div className="container fade-in" style={{ padding: "var(--sp-6) var(--sp-5)" }}>
      <PageHeader
        eyebrow="Mi cuenta"
        title="Mis subastas"
        subtitle="Historial completo de pujas y adjudicaciones"
      />

      {/* Quick stats */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "var(--sp-3)",
        marginBottom: "var(--sp-5)",
      }}>
        {[
          { label: "Total de pujas", value: totalBids, color: "var(--primary)" },
          { label: "Activas", value: winning, color: "var(--success)" },
          { label: "Ganadas", value: won, color: "var(--accent)" },
        ].map((s) => (
          <GlassCard key={s.label} padding="md">
            <p style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
              {s.label}
            </p>
            <p style={{ fontSize: "var(--t-2xl)", fontWeight: 800, color: s.color, letterSpacing: "-0.03em", marginTop: 4 }}>
              {s.value}
            </p>
          </GlassCard>
        ))}
      </div>

      {loading ? (
        <LoadingState />
      ) : bids.length === 0 ? (
        <EmptyState
          icon="🏷️"
          title="Aún no has participado en subastas"
          description="Explora el catálogo y realiza tu primera puja en un vehículo activo."
          action={
            <Link to="/vehicles">
              <GlassButton variant="primary">Ir al catálogo</GlassButton>
            </Link>
          }
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          {bids.map((bid) => {
            const vehicle = bid.vehicleId as Vehicle;
            const img = vehicle?.images?.[0] || CAR_PLACEHOLDER;
            const isWinner = bid.status === "winner";
            const isPaid = bid.status === "paid";

            return (
              <GlassCard key={bid._id}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "120px 1fr auto auto",
                    gap: "var(--sp-4)",
                    alignItems: "center",
                  }}
                >
                  {/* Thumbnail */}
                  <div style={{
                    width: 120, height: 80,
                    borderRadius: "var(--radius-md)",
                    overflow: "hidden",
                    background: "var(--bg-deep)",
                    boxShadow: "var(--nm-in-sm)",
                  }}>
                    <img src={img} alt={vehicle?.title} style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={(e) => { (e.target as HTMLImageElement).src = CAR_PLACEHOLDER; }} />
                  </div>

                  {/* Info */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: 4 }}>
                      <h3 style={{ fontSize: "var(--t-md)", color: "var(--text)" }}>
                        {vehicle?.title || "Vehículo"}
                      </h3>
                      <StatusBadge status={bid.status} />
                    </div>
                    <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)" }}>
                      {vehicle?.brand} {vehicle?.model} · {vehicle?.year}
                    </p>
                    <p style={{ fontSize: "var(--t-xs)", color: "var(--text-soft)", marginTop: 4 }}>
                      Puja realizada el {new Date(bid.createdAt).toLocaleDateString("es-PA", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>

                  {/* Amount */}
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: "var(--t-xs)", color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                      Tu puja
                    </p>
                    <p style={{
                      fontSize: "var(--t-xl)",
                      fontWeight: 800,
                      color: isWinner || isPaid ? "var(--accent)" : "var(--text)",
                      letterSpacing: "-0.03em",
                    }}>
                      ${bid.amount.toLocaleString()}
                    </p>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: 140 }}>
                    <Link to={`/vehicles/${typeof bid.vehicleId === "string" ? bid.vehicleId : vehicle?._id}`}>
                      <GlassButton variant="ghost" size="sm" fullWidth>Ver vehículo</GlassButton>
                    </Link>
                    {isWinner && (
                      <GlassButton variant="accent" size="sm" fullWidth onClick={() => handleCheckout(bid)}>
                        💳 Pagar ahora
                      </GlassButton>
                    )}
                    {isPaid && (
                      <Link to="/my-purchases">
                        <GlassButton variant="ghost" size="sm" fullWidth>
                          ✓ Ver compra
                        </GlassButton>
                      </Link>
                    )}
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
