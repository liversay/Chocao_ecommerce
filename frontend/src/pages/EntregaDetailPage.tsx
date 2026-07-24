import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import Card from "../components/Card";
import Button from "../components/Button";
import StatusBadge from "../components/StatusBadge";
import LoadingState from "../components/LoadingState";
import EmptyState from "../components/EmptyState";
import Logo from "../components/Logo";
import type { Entrega } from "../types";

const CLAVE_LABELS: Record<string, string> = {
  vin: "VIN",
  odometro: "Odómetro",
  placa: "Placa",
  frontal: "Frontal",
  posterior: "Posterior",
  lateral_izq: "Lateral izquierdo",
  lateral_der: "Lateral derecho",
  interior: "Interior",
  vano_motor: "Vano del motor",
};

// Vista mínima del acta/estado de una Entrega (RE-07) — no un visor de acta
// con diseño propio, solo los campos clave para que el comprador confirme
// que su entrega quedó registrada. Alcance de esta tarea: el tracker, no el
// renderizado del acta.
export default function EntregaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const api = useApi();
  const [entrega, setEntrega] = useState<Entrega | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .get(`/api/entrega/${id}`)
      .then((r) => setEntrega(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="container" style={{ padding: "var(--sp-6) var(--sp-5)" }}>
        <LoadingState />
      </div>
    );
  }

  if (error || !entrega) {
    return (
      <div className="container" style={{ padding: "var(--sp-6) var(--sp-5)" }}>
        <EmptyState title="Entrega no disponible" description="No pudimos encontrar esta entrega o no te pertenece." />
      </div>
    );
  }

  return (
    <div className="container fade-in" style={{ padding: "var(--sp-6) var(--sp-5)", maxWidth: 640 }}>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--sp-5)" }}>
        <Link to="/my-purchases" className="text-muted" style={{ fontSize: "var(--t-sm)", fontWeight: 500 }}>
          ← Volver a mis compras
        </Link>
        {entrega.estado === "ENTREGADA" && (
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            Imprimir / Guardar PDF
          </Button>
        )}
      </div>

      <Card padding="lg" variant="elevated">
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", marginBottom: "var(--sp-6)" }}>
          <Logo size={40} />
          <div>
            <p style={{ fontWeight: 800, fontSize: "var(--t-md)" }}>Chocao</p>
            <p className="eyebrow">Entrega del vehículo · República de Panamá</p>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-5)" }}>
          <div>
            <p className="eyebrow" style={{ marginBottom: 4 }}>Entrega</p>
            <p className="mono" style={{ fontSize: "var(--t-sm)" }}>{entrega._id}</p>
          </div>
          <StatusBadge status={entrega.estado} />
        </div>

        {entrega.estado === "BLOQUEADA" && entrega.motivoBloqueo && (
          <div
            style={{
              padding: "var(--sp-3) var(--sp-4)",
              background: "var(--danger-soft)",
              color: "var(--danger)",
              borderRadius: "var(--radius-md)",
              fontSize: "var(--t-sm)",
              fontWeight: 500,
              marginBottom: "var(--sp-5)",
            }}
          >
            {entrega.motivoBloqueo}. Un administrador revisará el caso.
          </div>
        )}

        <div style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "var(--sp-4) 0", marginBottom: "var(--sp-5)" }}>
          <p className="eyebrow" style={{ marginBottom: 8 }}>Cita programada</p>
          <p style={{ fontSize: "var(--t-sm)" }}>
            {new Date(entrega.citaProgramadaEn).toLocaleString("es-PA", { dateStyle: "long", timeStyle: "short" })}
          </p>
        </div>

        <div style={{ marginBottom: "var(--sp-5)" }}>
          <p className="eyebrow" style={{ marginBottom: 8 }}>Checklist de inspección ({entrega.checklist.length}/9)</p>
          {entrega.checklist.length === 0 ? (
            <p className="text-muted" style={{ fontSize: "var(--t-sm)" }}>Aún no hay ítems registrados.</p>
          ) : (
            <ul style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 0, listStyle: "none" }}>
              {entrega.checklist.map((c) => (
                <li key={c.clave} style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--t-sm)" }}>
                  <span style={{ color: "var(--text)" }}>{CLAVE_LABELS[c.clave] || c.clave}</span>
                  <a href={c.fotoUrl} target="_blank" rel="noreferrer" style={{ color: "var(--primary)" }}>
                    Ver foto
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {entrega.vinCapturado && (
          <div style={{ marginBottom: "var(--sp-5)" }}>
            <p className="eyebrow" style={{ marginBottom: 8 }}>VIN capturado</p>
            <p className="mono" style={{ fontSize: "var(--t-sm)" }}>{entrega.vinCapturado}</p>
          </div>
        )}

        {entrega.inventario.length > 0 && (
          <div style={{ marginBottom: "var(--sp-5)" }}>
            <p className="eyebrow" style={{ marginBottom: 8 }}>Inventario</p>
            <ul style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: 0, listStyle: "none" }}>
              {entrega.inventario.map((it, i) => (
                <li key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--t-sm)" }}>
                  <span>{it.item} × {it.cantidad}</span>
                  {it.faltante && <span style={{ color: "var(--danger)" }}>Faltante</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {entrega.estado === "ENTREGADA" && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <p style={{ fontSize: "var(--t-md)", fontWeight: 600 }}>Acta generada</p>
            <p className="text-muted" style={{ fontSize: "var(--t-sm)" }}>
              {entrega.actaGeneradaEn &&
                new Date(entrega.actaGeneradaEn).toLocaleString("es-PA", { dateStyle: "long", timeStyle: "short" })}
            </p>
          </div>
        )}
        {entrega.actaHash && (
          <p className="mono text-soft" style={{ fontSize: "10px", marginTop: "var(--sp-4)" }}>
            Hash del acta: {entrega.actaHash}
          </p>
        )}
      </Card>

      <style>{`@media print { .no-print { display: none !important; } }`}</style>
    </div>
  );
}
