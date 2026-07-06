import { useEffect, useState } from "react";
import { useSearchParams, Link, useLocation } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import Card from "../components/Card";
import Button from "../components/Button";
import LoadingState from "../components/LoadingState";

interface PaymentSummary {
  amount: number;
  vehicleId: string;
}

export default function CheckoutResultPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const api = useApi();
  const [status, setStatus] = useState<"loading" | "success" | "cancelled">("loading");
  const [payment, setPayment] = useState<PaymentSummary | null>(null);
  const [vehicleTitle, setVehicleTitle] = useState<string | null>(null);

  const isCancelRoute = location.pathname.includes("/cancel");

  useEffect(() => {
    if (isCancelRoute) {
      setStatus("cancelled");
      return;
    }
    const sessionId = params.get("session_id");
    if (sessionId) {
      api.get(`/api/payments/success?session_id=${sessionId}`)
        .then((r) => {
          setStatus(r.data.success ? "success" : "cancelled");
          if (r.data.success && r.data.payment) {
            setPayment({ amount: r.data.payment.amount, vehicleId: r.data.payment.vehicleId });
          }
        })
        .catch(() => setStatus("cancelled"));
    } else {
      setStatus("cancelled");
    }
  }, [isCancelRoute]);

  // Best-effort lookup of the vehicle title for the summary — read-only, doesn't
  // touch the payment confirmation flow above.
  useEffect(() => {
    if (!payment?.vehicleId) return;
    api.get(`/api/vehicles/${payment.vehicleId}`)
      .then((r) => setVehicleTitle(r.data?.title || null))
      .catch(() => setVehicleTitle(null));
  }, [payment?.vehicleId]);

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "70vh", padding: "var(--sp-5)" }}>
      <Card variant="elevated" padding="lg" style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
        {status === "loading" && <LoadingState message="Verificando tu pago..." />}

        {status === "success" && (
          <div className="fade-in">
            <div
              style={{
                width: 72, height: 72,
                borderRadius: "50%",
                background: "var(--success-soft)",
                color: "var(--success)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "2rem",
                fontWeight: 700,
                margin: "0 auto var(--sp-4)",
              }}
            >
              ✓
            </div>
            <h1 style={{ fontSize: "var(--t-xl)", color: "var(--text)", marginBottom: "var(--sp-2)" }}>
              Pago confirmado
            </h1>
            <p style={{ color: "var(--text-muted)", marginBottom: "var(--sp-5)", fontSize: "var(--t-sm)", lineHeight: 1.6 }}>
              Tu pago fue procesado correctamente. El vehículo ha sido adjudicado a tu nombre.
              Recibirás instrucciones para coordinar la entrega al correo registrado.
            </p>

            {payment && (
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "var(--sp-4)",
                  marginBottom: "var(--sp-5)",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)" }}>Vehículo</span>
                  <span style={{ fontSize: "var(--t-sm)", fontWeight: 600, color: "var(--text)" }}>
                    {vehicleTitle || "—"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "var(--t-xs)", color: "var(--text-muted)" }}>Monto pagado</span>
                  <span className="mono price-accent" style={{ fontSize: "var(--t-sm)", fontWeight: 700 }}>
                    ${payment.amount.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            <Link to="/my-purchases">
              <Button variant="primary" fullWidth>Ver mis compras</Button>
            </Link>
          </div>
        )}

        {status === "cancelled" && (
          <div className="fade-in">
            <div
              style={{
                width: 72, height: 72,
                borderRadius: "50%",
                background: "var(--danger-soft)",
                color: "var(--danger)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "2rem",
                fontWeight: 700,
                margin: "0 auto var(--sp-4)",
              }}
            >
              ×
            </div>
            <h1 style={{ fontSize: "var(--t-xl)", color: "var(--text)", marginBottom: "var(--sp-2)" }}>
              Pago no completado
            </h1>
            <p style={{ color: "var(--text-muted)", marginBottom: "var(--sp-5)", fontSize: "var(--t-sm)", lineHeight: 1.6 }}>
              El proceso de pago fue cancelado. Puedes intentarlo nuevamente desde tus subastas
              o contactarnos si necesitas asistencia.
            </p>
            <Link to="/my-bids">
              <Button variant="primary" fullWidth>Volver a mis pujas</Button>
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}
