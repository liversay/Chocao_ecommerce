import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@clerk/react";
import { useApi } from "../hooks/useApi";
import Card from "../components/Card";
import Button from "../components/Button";
import DataTable from "../components/DataTable";
import BidForm from "../components/BidForm";
import StatusBadge from "../components/StatusBadge";
import LoadingState from "../components/LoadingState";
import EmptyState from "../components/EmptyState";
import Countdown from "../components/Countdown";
import { CONDITION_LABELS } from "../lib/labels";
import type { Vehicle, Bid } from "../types";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const CAR_PLACEHOLDER = "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=900&q=80";

interface Spec {
  _id?: string;
  label: string;
  value: string | number;
}

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
  const hasEnded = vehicle.auctionEndDate ? new Date(vehicle.auctionEndDate) < new Date() : false;

  const specs: Spec[] = [
    { label: "Marca", value: vehicle.brand },
    { label: "Modelo", value: vehicle.model },
    { label: "Año", value: vehicle.year },
    { label: "Color", value: vehicle.color || "—" },
    { label: "Kilometraje", value: vehicle.mileage ? `${vehicle.mileage.toLocaleString()} km` : "—" },
    { label: "Condición", value: (vehicle.condition && CONDITION_LABELS[vehicle.condition]) || vehicle.condition || "—" },
  ];

  return (
    <div className="container fade-in" style={{ padding: "var(--sp-6) var(--sp-5)" }}>
      <Link
        to="/vehicles"
        className="text-muted"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "var(--t-sm)",
          marginBottom: "var(--sp-5)",
          fontWeight: 500,
        }}
      >
        ← Volver al catálogo
      </Link>

      <div className="detail-grid" style={{ alignItems: "start" }}>
        {/* LEFT: Gallery + specs */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
          <Card padding="sm">
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
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
                      width: 80,
                      height: 60,
                      borderRadius: "var(--radius-sm)",
                      overflow: "hidden",
                      border: i === activeImg ? "2px solid var(--primary)" : "1px solid var(--border)",
                      flexShrink: 0,
                      cursor: "pointer",
                      padding: 0,
                      transition: "border-color var(--dur)",
                    }}
                  >
                    <img src={img} alt={`${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "var(--sp-5)",
                flexWrap: "wrap",
                gap: "var(--sp-3)",
              }}
            >
              <div>
                <p className="eyebrow" style={{ marginBottom: 4 }}>
                  {vehicle.brand} · {vehicle.year}
                </p>
                <h1 style={{ fontSize: "var(--t-2xl)" }}>{vehicle.title}</h1>
              </div>
              <StatusBadge status={vehicle.status} />
            </div>

            <DataTable<Spec>
              columns={[
                { header: "Especificación", accessor: (r: Spec) => <span className="text-muted">{r.label}</span> },
                { header: "Valor", accessor: (r: Spec) => <strong>{r.value}</strong>, align: "right" },
              ]}
              data={specs}
              dense
            />

            {vehicle.description && (
              <div style={{ marginTop: "var(--sp-5)" }}>
                <h3
                  style={{
                    fontSize: "var(--t-sm)",
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: "var(--sp-2)",
                  }}
                >
                  Descripción
                </h3>
                <p style={{ color: "var(--text)", fontSize: "var(--t-sm)", lineHeight: 1.65 }}>
                  {vehicle.description}
                </p>
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT: Bid panel (sticky) */}
        <div style={{ position: "sticky", top: 88 }}>
          <Card variant="elevated" padding="lg">
            <p className="text-soft" style={{ fontSize: "var(--t-xs)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
              Precio base
            </p>
            <p className="text-muted" style={{ fontSize: "var(--t-md)", fontWeight: 600, marginBottom: "var(--sp-4)" }}>
              ${vehicle.basePrice.toLocaleString()}
            </p>

            <p className="eyebrow" style={{ marginBottom: 4 }}>Oferta actual</p>
            <p className="price-accent" style={{ fontSize: "var(--t-3xl)", letterSpacing: "-0.03em", lineHeight: 1, marginBottom: "var(--sp-4)" }}>
              ${vehicle.currentPrice.toLocaleString()}
            </p>

            {vehicle.auctionEndDate && (
              <div style={{ marginBottom: "var(--sp-4)", paddingBottom: "var(--sp-4)", borderBottom: "1px solid var(--hairline)" }}>
                <Countdown endDate={vehicle.auctionEndDate} />
              </div>
            )}

            {feedback && (
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: "var(--radius-sm)",
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

            {!isActive || hasEnded ? (
              <div
                style={{
                  padding: "var(--sp-4)",
                  textAlign: "center",
                  background: "var(--bg-alt)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text-muted)",
                  fontSize: "var(--t-sm)",
                }}
              >
                {hasEnded ? "La subasta ha finalizado." : "Este vehículo no está abierto para pujas en este momento."}
              </div>
            ) : !isSignedIn ? (
              <div style={{ textAlign: "center" }}>
                <p className="text-muted" style={{ fontSize: "var(--t-sm)", marginBottom: "var(--sp-3)" }}>
                  Inicia sesión para participar en esta subasta
                </p>
                <Link to="/login">
                  <Button variant="primary" fullWidth size="lg">Ingresar para pujar</Button>
                </Link>
              </div>
            ) : (
              <BidForm currentPrice={vehicle.currentPrice} onSubmit={handleBid} />
            )}

            {bids.length > 0 && (
              <div style={{ marginTop: "var(--sp-5)", paddingTop: "var(--sp-4)", borderTop: "1px solid var(--hairline)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-3)" }}>
                  <h2
                    style={{
                      fontSize: "var(--t-sm)",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Historial de pujas
                  </h2>
                  <span className="text-soft" style={{ fontSize: "var(--t-xs)" }}>
                    {bids.length} {bids.length === 1 ? "puja" : "pujas"}
                  </span>
                </div>
                <div>
                  {bids.slice(0, 5).map((b, i) => (
                    <div
                      key={b._id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 0",
                        borderBottom: i < Math.min(bids.length, 5) - 1 ? "1px solid var(--hairline)" : "none",
                      }}
                    >
                      <span style={{ fontSize: "var(--t-xs)", color: "var(--text-soft)" }}>
                        {new Date(b.createdAt).toLocaleString("es-PA", { dateStyle: "medium", timeStyle: "short" })}
                      </span>
                      <span className={i === 0 ? "price-accent" : "mono"} style={{ fontSize: "var(--t-sm)", fontWeight: 700 }}>
                        ${b.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
