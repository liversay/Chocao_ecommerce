import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import Card from "../components/Card";
import Button from "../components/Button";
import LoadingState from "../components/LoadingState";
import EmptyState from "../components/EmptyState";
import Logo from "../components/Logo";
import type { Receipt } from "../types";

export default function ReceiptPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const api = useApi();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .get(`/api/payments/${paymentId}/receipt`)
      .then((r) => setReceipt(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [paymentId]);

  if (loading) {
    return (
      <div className="container" style={{ padding: "var(--sp-6) var(--sp-5)" }}>
        <LoadingState />
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="container" style={{ padding: "var(--sp-6) var(--sp-5)" }}>
        <EmptyState icon="🧾" title="Recibo no disponible" description="No pudimos encontrar este recibo o no te pertenece." />
      </div>
    );
  }

  return (
    <div className="container fade-in" style={{ padding: "var(--sp-6) var(--sp-5)", maxWidth: 640 }}>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--sp-5)" }}>
        <Link to="/my-purchases" className="text-muted" style={{ fontSize: "var(--t-sm)", fontWeight: 500 }}>
          ← Volver a mis compras
        </Link>
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          Imprimir / Guardar PDF
        </Button>
      </div>

      <Card padding="lg" variant="elevated">
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", marginBottom: "var(--sp-6)" }}>
          <Logo size={40} />
          <div>
            <p style={{ fontWeight: 800, fontSize: "var(--t-md)" }}>Chocao</p>
            <p className="eyebrow">Recibo de pago · República de Panamá</p>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--sp-5)" }}>
          <div>
            <p className="eyebrow" style={{ marginBottom: 4 }}>Recibo</p>
            <p className="mono" style={{ fontSize: "var(--t-sm)" }}>{receipt.paymentId}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p className="eyebrow" style={{ marginBottom: 4 }}>Fecha</p>
            <p style={{ fontSize: "var(--t-sm)" }}>
              {new Date(receipt.paidAt).toLocaleString("es-PA", { dateStyle: "long", timeStyle: "short" })}
            </p>
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "var(--sp-4) 0", marginBottom: "var(--sp-5)" }}>
          <p className="eyebrow" style={{ marginBottom: 8 }}>Vehículo adjudicado</p>
          <p style={{ fontSize: "var(--t-md)", fontWeight: 600 }}>{receipt.vehicle.title}</p>
          <p className="text-muted" style={{ fontSize: "var(--t-sm)", marginTop: 4 }}>
            {receipt.vehicle.brand} · {receipt.vehicle.model} · {receipt.vehicle.year}
          </p>
        </div>

        <div style={{ borderBottom: "1px solid var(--border)", padding: "var(--sp-4) 0", marginBottom: "var(--sp-5)" }}>
          <p className="eyebrow" style={{ marginBottom: 8 }}>Comprador</p>
          <p style={{ fontSize: "var(--t-sm)", fontWeight: 600 }}>{receipt.buyerName}</p>
          <p className="text-muted" style={{ fontSize: "var(--t-sm)" }}>{receipt.buyerEmail}</p>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <p style={{ fontSize: "var(--t-md)", fontWeight: 600 }}>Total pagado</p>
          <p className="price-accent" style={{ fontSize: "var(--t-2xl)" }}>${receipt.amount.toLocaleString()}</p>
        </div>

        {receipt.stripeSessionId && (
          <p className="mono text-soft" style={{ fontSize: "10px", marginTop: "var(--sp-4)" }}>
            Sesión de pago: {receipt.stripeSessionId}
          </p>
        )}
      </Card>

      <style>{`@media print { .no-print { display: none !important; } }`}</style>
    </div>
  );
}
