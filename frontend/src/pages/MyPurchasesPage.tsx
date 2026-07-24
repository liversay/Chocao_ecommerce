import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Car } from "lucide-react";
import { useApi } from "../hooks/useApi";
import Card from "../components/Card";
import Button from "../components/Button";
import Select from "../components/Select";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";
import StatusBadge from "../components/StatusBadge";
import type { Bid, Vehicle, Deposito } from "../types";

const CAR_PLACEHOLDER = "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400&q=80";

export default function MyPurchasesPage() {
  const api = useApi();
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);

  // "Agendar cita" — modal mínimo de depósito/slot para iniciar una Entrega.
  const [agendando, setAgendando] = useState<Bid | null>(null);
  const [depositos, setDepositos] = useState<Deposito[]>([]);
  const [loadingDepositos, setLoadingDepositos] = useState(false);
  const [depositoId, setDepositoId] = useState("");
  const [slotId, setSlotId] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [agendarError, setAgendarError] = useState("");

  function load() {
    setLoading(true);
    api.get("/api/bids/my/purchases")
      .then((r) => setPurchases(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const totalSpent = purchases.reduce((sum, b) => sum + b.amount, 0);

  function vehicleHref(bid: Bid) {
    const vehicle = bid.vehicleId as Vehicle;
    return `/vehicles/${typeof bid.vehicleId === "string" ? bid.vehicleId : vehicle?._id}`;
  }

  function abrirAgendarCita(bid: Bid) {
    setAgendarError("");
    setDepositoId("");
    setSlotId("");
    setAgendando(bid);
    setLoadingDepositos(true);
    api
      .get("/api/depositos")
      .then((r) => setDepositos(r.data))
      .catch(() => setAgendarError("No se pudieron cargar los depósitos disponibles."))
      .finally(() => setLoadingDepositos(false));
  }

  function cerrarAgendarCita() {
    if (confirmando) return;
    setAgendando(null);
  }

  async function confirmarCita() {
    if (!agendando?.payment || !depositoId || !slotId) return;
    setConfirmando(true);
    setAgendarError("");
    try {
      await api.post("/api/entrega", {
        paymentId: agendando.payment.id,
        depositoId,
        slotId,
      });
      setAgendando(null);
      load();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "No se pudo agendar la cita. Intenta de nuevo.";
      setAgendarError(message);
    } finally {
      setConfirmando(false);
    }
  }

  const depositoSeleccionado = depositos.find((d) => d._id === depositoId);

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
                header: "Entrega",
                accessor: (bid) =>
                  bid.entrega ? (
                    <StatusBadge status={bid.entrega.estado} />
                  ) : (
                    <span style={{ color: "var(--text-soft)", fontSize: "var(--t-xs)" }}>Sin agendar</span>
                  ),
              },
              {
                header: "",
                align: "right",
                accessor: (bid) => (
                  <div style={{ display: "flex", gap: "var(--sp-2)", justifyContent: "flex-end" }}>
                    {bid.payment && (
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/receipt/${bid.payment!.id}`)}>
                        Ver recibo
                      </Button>
                    )}
                    {!bid.entrega && bid.payment && (
                      <Button variant="secondary" size="sm" onClick={() => abrirAgendarCita(bid)}>
                        Agendar cita
                      </Button>
                    )}
                    {bid.entrega && bid.entrega.estado === "ENTREGADA" && (
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/entrega/${bid.entrega!.id}`)}>
                        Ver acta
                      </Button>
                    )}
                    {bid.entrega && (bid.entrega.estado === "CITA_AGENDADA" || bid.entrega.estado === "EN_INSPECCION") && (
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/entrega/${bid.entrega!.id}`)}>
                        Ver detalle
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
            data={purchases}
            emptyMessage="No hay compras registradas"
          />
        )}
      </Card>

      {agendando && (
        <div
          onClick={cerrarAgendarCita}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "var(--sp-4)",
          }}
        >
          <Card
            variant="elevated"
            padding="lg"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 460, width: "100%" }}
          >
            <h3 style={{ fontSize: "var(--t-lg)", color: "var(--text)", marginBottom: "var(--sp-2)" }}>
              Agendar cita de entrega
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)", marginBottom: "var(--sp-4)" }}>
              Elige el depósito y el horario donde recibirás el vehículo para su inspección.
            </p>

            {loadingDepositos ? (
              <LoadingState message="Cargando depósitos..." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
                <Select
                  label="Depósito"
                  options={[
                    { value: "", label: "Selecciona un depósito…" },
                    ...depositos.map((d) => ({ value: d._id, label: `${d.nombre} — ${d.direccion}` })),
                  ]}
                  value={depositoId}
                  onChange={(e) => { setDepositoId(e.target.value); setSlotId(""); }}
                />

                {depositoSeleccionado && (
                  <Select
                    label="Horario"
                    options={[
                      { value: "", label: "Selecciona un horario…" },
                      ...depositoSeleccionado.slots
                        .filter((s) => s.ocupados < s.capacidad)
                        .map((s) => ({
                          value: s._id,
                          label: `${new Date(s.inicio).toLocaleString("es-PA", { dateStyle: "medium", timeStyle: "short" })} – ${new Date(s.fin).toLocaleTimeString("es-PA", { timeStyle: "short" })}`,
                        })),
                    ]}
                    value={slotId}
                    onChange={(e) => setSlotId(e.target.value)}
                  />
                )}

                {agendarError && (
                  <p style={{ color: "var(--danger)", fontSize: "var(--t-sm)", fontWeight: 500 }}>{agendarError}</p>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: "var(--sp-2)", justifyContent: "flex-end", marginTop: "var(--sp-5)" }}>
              <Button variant="ghost" onClick={cerrarAgendarCita} disabled={confirmando}>Cancelar</Button>
              <Button
                variant="primary"
                onClick={confirmarCita}
                disabled={confirmando || !depositoId || !slotId}
              >
                {confirmando ? "Agendando..." : "Confirmar cita"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
