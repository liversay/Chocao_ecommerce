import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@clerk/react";
import { useApi } from "../hooks/useApi";
import GlassCard from "../components/GlassCard";
import GlassButton from "../components/GlassButton";
import BidForm from "../components/BidForm";
import StatusBadge from "../components/StatusBadge";
import LoadingState from "../components/LoadingState";
import EmptyState from "../components/EmptyState";
import Countdown from "../components/Countdown";
import type { Vehicle, Bid } from "../types";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const CAR_PLACEHOLDER = "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=900&q=80";

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isSignedIn } = useAuth();
  const api = useApi();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  function loadData() {
    setLoading(true);
    Promise.all([
      axios.get(`${BASE_URL}/api/vehicles/${id}`),
      axios.get(`${BASE_URL}/api/bids/vehicle/${id}`),
    ])
      .then(([vRes, bRes]) => { setVehicle(vRes.data); setBids(bRes.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, [id]);

  async function handleBid(amount: number) {
    await api.post(`/api/bids/vehicle/${id}`, { amount });
    setFeedback({ type: "success", msg: `Puja de $${amount.toLocaleString()} registrada` });
    setTimeout(() => setFeedback(null), 4000);
    loadData();
  }

  if (loading) return <div className="container" style={{ padding: "var(--sp-6) var(--sp-5)" }}><LoadingState /></div>;
  if (!vehicle) return (
    <div className="container" style={{ padding: "var(--sp-6) var(--sp-5)" }}>
      <EmptyState icon="❌" title="Vehículo no encontrado" />
    </div>
  );

  const images = vehicle.images?.length ? vehicle.images : [CAR_PLACEHOLDER];
  const isActive = vehicle.status === "active";

  const specs = [
    { label: "Marca", value: vehicle.brand },
    { label: "Modelo", value: vehicle.model },
    { label: "Año", value: vehicle.year },
    { label: "Color", value: vehicle.color || "—" },
    { label: "Kilometraje", value: vehicle.mileage ? `${vehicle.mileage.toLocaleString()} km` : "—" },
    { label: "Condición", value: vehicle.condition || "—" },
  ];

  return (
    <div className="container fade-in" style={{ padding: "var(--sp-6) var(--sp-5)" }}>
      <Link to="/vehicles" style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        color: "var(--text-muted)",
        fontSize: "var(--t-sm)",
        marginBottom: "var(--sp-5)",
        fontWeight: 500,
      }}>
        ← Volver al catálogo
      </Link>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "var(--sp-5)", alignItems: "start" }}>
        {/* LEFT: Gallery + Info */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          {/* Gallery */}
          <GlassCard padding="sm">
            <div
              style={{
                background: "var(--bg-deep)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--nm-in-sm)",
                height: 420,
                overflow: "hidden",
                marginBottom: images.length > 1 ? "var(--sp-3)" : 0,
              }}
            >
              <img
                src={images[activeImg]}
                alt={vehicle.title}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={(e) => { (e.target as HTMLImageElement).src = CAR_PLACEHOLDER; }}
              />
            </div>
            {images.length > 1 && (
              <div style={{ display: "flex", gap: "8px", overflowX: "auto" }}>
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    style={{
                      width: 80, height: 60,
                      borderRadius: "var(--radius-sm)",
                      overflow: "hidden",
                      border: "none",
                      flexShrink: 0,
                      background: "var(--bg-deep)",
                      boxShadow: i === activeImg ? "var(--nm-in-sm)" : "var(--nm-out-sm)",
                      cursor: "pointer",
                      padding: 0,
                      transition: "all 0.15s",
                    }}
                  >
                    <img src={img} alt={`${i+1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </button>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Header */}
          <GlassCard>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--sp-4)", flexWrap: "wrap", gap: "var(--sp-3)" }}>
              <div>
                <p style={{ fontSize: "var(--t-xs)", color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, marginBottom: 4 }}>
                  {vehicle.brand} · {vehicle.year}
                </p>
                <h1 style={{ fontSize: "var(--t-2xl)", color: "var(--text)" }}>{vehicle.title}</h1>
              </div>
              <StatusBadge status={vehicle.status} />
            </div>

            {/* Specs grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: "var(--sp-3)",
                padding: "var(--sp-4)",
                background: "var(--surface)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--nm-in-sm)",
                marginBottom: vehicle.description ? "var(--sp-4)" : 0,
              }}
            >
              {specs.map((s) => (
                <div key={s.label}>
                  <p style={{ fontSize: "0.7rem", color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
                    {s.label}
                  </p>
                  <p style={{ fontSize: "var(--t-base)", fontWeight: 600, color: "var(--text)", marginTop: 2 }}>
                    {s.value}
                  </p>
                </div>
              ))}
            </div>

            {vehicle.description && (
              <div>
                <h3 style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--sp-2)" }}>
                  Descripción
                </h3>
                <p style={{ color: "var(--text)", fontSize: "var(--t-sm)", lineHeight: 1.65 }}>
                  {vehicle.description}
                </p>
              </div>
            )}
          </GlassCard>

          {/* Bid history */}
          <GlassCard>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-4)" }}>
              <h2 style={{ fontSize: "var(--t-md)", color: "var(--text)" }}>
                Historial de pujas
              </h2>
              <span style={{
                background: "var(--surface)",
                boxShadow: "var(--nm-in-sm)",
                padding: "4px 12px",
                borderRadius: "var(--radius-pill)",
                fontSize: "var(--t-xs)",
                fontWeight: 700,
                color: "var(--text-muted)",
              }}>
                {bids.length} {bids.length === 1 ? "puja" : "pujas"}
              </span>
            </div>

            {bids.length === 0 ? (
              <p style={{ color: "var(--text-soft)", textAlign: "center", padding: "var(--sp-5)", fontSize: "var(--t-sm)" }}>
                Aún no se han registrado pujas en este vehículo.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {bids.slice(0, 8).map((b, i) => (
                  <div
                    key={b._id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--sp-3)",
                      padding: "var(--sp-3)",
                      borderRadius: "var(--radius-md)",
                      background: "var(--surface)",
                      boxShadow: i === 0 ? "var(--nm-out-sm)" : "var(--nm-flat)",
                    }}
                  >
                    <div style={{
                      width: 32, height: 32,
                      borderRadius: "50%",
                      background: i === 0 ? "var(--accent-soft)" : "var(--bg-deep)",
                      color: i === 0 ? "var(--accent)" : "var(--text-soft)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 700,
                      fontSize: "var(--t-xs)",
                    }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "var(--t-sm)", fontWeight: 600, color: "var(--text)" }}>
                        {typeof b.userId === "object" ? (b.userId as { name: string }).name : "Usuario"}
                      </p>
                      <p style={{ fontSize: "var(--t-xs)", color: "var(--text-soft)" }}>
                        {new Date(b.createdAt).toLocaleString("es-PA", { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: "var(--t-md)", fontWeight: 700, color: i === 0 ? "var(--accent)" : "var(--text)", letterSpacing: "-0.01em" }}>
                        ${b.amount.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>

        {/* RIGHT: Bid panel */}
        <div style={{ position: "sticky", top: 90 }}>
          <GlassCard padding="lg">
            {/* Price */}
            <div style={{ marginBottom: "var(--sp-5)" }}>
              <p style={{ fontSize: "var(--t-xs)", color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
                Precio base
              </p>
              <p style={{ fontSize: "var(--t-md)", color: "var(--text-muted)", fontWeight: 600 }}>
                ${vehicle.basePrice.toLocaleString()}
              </p>
            </div>

            <div
              style={{
                padding: "var(--sp-4)",
                background: "var(--surface)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--nm-in-sm)",
                marginBottom: "var(--sp-4)",
                textAlign: "center",
              }}
            >
              <p style={{ fontSize: "var(--t-xs)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 6 }}>
                Oferta actual
              </p>
              <p style={{
                fontSize: "var(--t-3xl)",
                fontWeight: 800,
                color: "var(--accent)",
                letterSpacing: "-0.04em",
                lineHeight: 1,
              }}>
                ${vehicle.currentPrice.toLocaleString()}
              </p>
            </div>

            {vehicle.auctionEndDate && (
              <div style={{ marginBottom: "var(--sp-4)" }}>
                <Countdown endDate={vehicle.auctionEndDate} />
              </div>
            )}

            {feedback && (
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: "var(--radius-md)",
                  background: feedback.type === "success" ? "var(--success-soft)" : "var(--danger-soft)",
                  color: feedback.type === "success" ? "var(--success)" : "var(--danger)",
                  fontSize: "var(--t-sm)",
                  marginBottom: "var(--sp-3)",
                  fontWeight: 500,
                  textAlign: "center",
                }}
              >
                {feedback.msg}
              </div>
            )}

            {!isActive ? (
              <div
                style={{
                  padding: "var(--sp-4)",
                  textAlign: "center",
                  background: "var(--surface)",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "var(--nm-in-sm)",
                  color: "var(--text-muted)",
                  fontSize: "var(--t-sm)",
                }}
              >
                Este vehículo no está abierto para pujas en este momento.
              </div>
            ) : !isSignedIn ? (
              <div style={{ textAlign: "center" }}>
                <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)", marginBottom: "var(--sp-3)" }}>
                  Inicia sesión para participar en esta subasta
                </p>
                <Link to="/login">
                  <GlassButton variant="primary" fullWidth size="lg">Ingresar para pujar</GlassButton>
                </Link>
              </div>
            ) : (
              <BidForm currentPrice={vehicle.currentPrice} onSubmit={handleBid} />
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
