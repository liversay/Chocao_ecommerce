import { useEffect, useState } from "react";
import { useSearchParams, Link, useLocation } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import GlassCard from "../components/GlassCard";
import GlassButton from "../components/GlassButton";
import LoadingState from "../components/LoadingState";

export default function CheckoutResultPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const api = useApi();
  const [status, setStatus] = useState<"loading" | "success" | "cancelled">("loading");

  const isCancelRoute = location.pathname.includes("/cancel");

  useEffect(() => {
    if (isCancelRoute) {
      setStatus("cancelled");
      return;
    }
    const sessionId = params.get("session_id");
    if (sessionId) {
      api.get(`/api/payments/success?session_id=${sessionId}`)
        .then((r) => setStatus(r.data.success ? "success" : "cancelled"))
        .catch(() => setStatus("cancelled"));
    } else {
      setStatus("cancelled");
    }
  }, [isCancelRoute]);

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "70vh", padding: "var(--sp-5)" }}>
      <GlassCard padding="lg" style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
        {status === "loading" && <LoadingState message="Verificando tu pago..." />}

        {status === "success" && (
          <div className="fade-in">
            <div
              style={{
                width: 88, height: 88,
                borderRadius: "50%",
                background: "var(--success-soft)",
                color: "var(--success)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "2.4rem",
                margin: "0 auto var(--sp-4)",
                boxShadow: "var(--nm-out-md)",
                fontWeight: 700,
              }}
            >
              ✓
            </div>
            <h1 style={{ fontSize: "var(--t-xl)", color: "var(--success)", marginBottom: "var(--sp-2)" }}>
              Pago confirmado
            </h1>
            <p style={{ color: "var(--text-muted)", marginBottom: "var(--sp-5)", fontSize: "var(--t-sm)", lineHeight: 1.6 }}>
              Tu pago fue procesado correctamente. El vehículo ha sido adjudicado a tu nombre.
              Recibirás instrucciones para coordinar la entrega al correo registrado.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
              <Link to="/my-bids">
                <GlassButton variant="primary" fullWidth>Ver mis subastas</GlassButton>
              </Link>
              <Link to="/vehicles">
                <GlassButton variant="ghost" fullWidth>Volver al catálogo</GlassButton>
              </Link>
            </div>
          </div>
        )}

        {status === "cancelled" && (
          <div className="fade-in">
            <div
              style={{
                width: 88, height: 88,
                borderRadius: "50%",
                background: "var(--danger-soft)",
                color: "var(--danger)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "2.4rem",
                margin: "0 auto var(--sp-4)",
                boxShadow: "var(--nm-out-md)",
                fontWeight: 700,
              }}
            >
              ×
            </div>
            <h1 style={{ fontSize: "var(--t-xl)", color: "var(--danger)", marginBottom: "var(--sp-2)" }}>
              Pago no completado
            </h1>
            <p style={{ color: "var(--text-muted)", marginBottom: "var(--sp-5)", fontSize: "var(--t-sm)", lineHeight: 1.6 }}>
              El proceso de pago fue cancelado. Puedes intentarlo nuevamente desde tus subastas
              o contactarnos si necesitas asistencia.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
              <Link to="/my-bids">
                <GlassButton variant="primary" fullWidth>Reintentar pago</GlassButton>
              </Link>
              <Link to="/vehicles">
                <GlassButton variant="ghost" fullWidth>Volver al catálogo</GlassButton>
              </Link>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
