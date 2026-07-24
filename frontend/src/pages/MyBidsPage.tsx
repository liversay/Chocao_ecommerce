import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Gavel, AlertTriangle } from "lucide-react";
import { useApi } from "../hooks/useApi";
import Card from "../components/Card";
import Button from "../components/Button";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";
import StatusBadge from "../components/StatusBadge";
import Countdown from "../components/Countdown";
import { startCheckout } from "../lib/checkout";
import type { Bid, Vehicle } from "../types";

const CAR_PLACEHOLDER = "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400&q=80";

export default function MyBidsPage() {
  const api = useApi();
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api.get("/api/bids/my")
      .then((r) => setBids(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCheckout(bid: Bid) {
    try {
      await startCheckout(api, bid._id);
    } catch {
      alert("Error al iniciar el pago. Intenta nuevamente.");
    }
  }

  // Aceptar la oferta de segundo mejor postor (RP-05): el propio bid pasa a
  // ganador con su propio plazo de pago — refrescamos la lista para traer el
  // nuevo estado/plazo en vez de intentar reconstruirlo en el cliente.
  async function handleAcceptOffer(adjudicacionId: string) {
    setAcceptingId(adjudicacionId);
    try {
      await api.post(`/api/adjudicaciones/${adjudicacionId}/aceptar-oferta`);
      load();
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      alert(message || "No se pudo aceptar la oferta. Intenta nuevamente.");
    } finally {
      setAcceptingId(null);
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
            icon={<Gavel size={32} strokeWidth={1.5} color="var(--text-muted)" />}
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
                accessor: (bid) => {
                  const adj = bid.adjudicacion;

                  // Oferta al segundo mejor postor (RP-05): solo aparece para
                  // el bid que ES el segundoBidId de esa Adjudicacion — el
                  // adjudicatario original inhabilitado comparte la misma
                  // Adjudicacion (por vehicleId) pero no puede aceptarla.
                  if (adj?.estado === "OFERTA_A_SEGUNDO" && adj.esSegundoPostor) {
                    return (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        <span style={{ color: "var(--text-muted)", fontSize: "var(--t-xs)" }}>
                          El adjudicatario original incumplió
                        </span>
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={acceptingId === adj.id}
                          onClick={() => handleAcceptOffer(adj.id)}
                        >
                          {acceptingId === adj.id ? "Aceptando..." : "Aceptar oferta"}
                        </Button>
                      </div>
                    );
                  }

                  if (bid.status !== "winner") return null;

                  // Gate de plazo legal de pago (RP-02) en el cliente: solo
                  // afecta lo que se muestra aquí — el backend vuelve a
                  // validar el mismo plazo en createCheckout, así que esto es
                  // defensa en profundidad, no la única barrera.
                  const vencido =
                    adj?.estado === "ADJUDICADA_PENDIENTE_PAGO" && new Date(adj.fechaLimitePago) < new Date();

                  if (vencido) {
                    return (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          color: "var(--danger)",
                          fontSize: "var(--t-xs)",
                          fontWeight: 600,
                        }}
                      >
                        <AlertTriangle size={14} strokeWidth={2} />
                        Plazo de pago vencido
                      </span>
                    );
                  }

                  return (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      {adj?.estado === "ADJUDICADA_PENDIENTE_PAGO" && (
                        <Countdown endDate={adj.fechaLimitePago} variant="compact" />
                      )}
                      <Button variant="primary" size="sm" onClick={() => handleCheckout(bid)}>
                        Pagar ahora
                      </Button>
                    </div>
                  );
                },
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
