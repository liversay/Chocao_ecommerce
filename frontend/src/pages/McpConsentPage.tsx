import { useState } from "react";
import { useSearchParams } from "react-router";
import { useApi } from "../hooks/useApi";
import Button from "../components/Button";
import Card from "../components/Card";
import PageHeader from "../components/PageHeader";

// Descripciones legibles de los scopes OAuth del servidor MCP
const SCOPE_LABELS: Record<string, string> = {
  "catalog:read": "Ver el catálogo público de vehículos",
  "bids:read": "Ver tus pujas y compras",
  "bids:write": "Pujar en tu nombre (con tu confirmación)",
  "payments:write": "Generar enlaces de pago de tus pujas ganadoras",
  "payment:refund": "Procesar reembolsos (finanzas)",
  "vehicle:write": "Crear y gestionar vehículos del catálogo",
  "dashboard:read": "Consultar los KPIs del dashboard",
  "report:read": "Consultar reportes y actividad global",
  "users:manage": "Gestionar roles de usuarios",
  "audit:read": "Consultar el registro de auditoría",
};

export default function McpConsentPage() {
  const [params] = useSearchParams();
  const api = useApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientName = params.get("client_id") ?? "un agente externo";
  const scopes = (params.get("scope") ?? "").split(/\s+/).filter(Boolean);

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post("/oauth/authorize/approve", {
        client_id: params.get("client_id"),
        redirect_uri: params.get("redirect_uri"),
        scope: params.get("scope") || undefined,
        state: params.get("state") || undefined,
        code_challenge: params.get("code_challenge"),
      });
      window.location.href = data.redirect;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo autorizar");
      setBusy(false);
    }
  }

  function deny() {
    const redirectUri = params.get("redirect_uri");
    if (!redirectUri) return window.history.back();
    const url = new URL(redirectUri);
    url.searchParams.set("error", "access_denied");
    const state = params.get("state");
    if (state) url.searchParams.set("state", state);
    window.location.href = url.toString();
  }

  return (
    <div className="container fade-in" style={{ padding: "var(--sp-7) var(--sp-5)", maxWidth: 560 }}>
      <PageHeader
        eyebrow="Conexión MCP"
        title="Autorizar acceso de un agente"
        subtitle="Un agente de IA (Claude Code u otro cliente MCP) quiere conectarse a tu cuenta de Chocao."
      />

      <Card style={{ padding: "var(--sp-5)" }}>
        <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", marginBottom: "var(--sp-4)" }}>
          Cliente: <code className="mono">{clientName}</code>
        </p>

        <p style={{ fontSize: "var(--t-sm)", fontWeight: 700, marginBottom: "var(--sp-2)" }}>
          El agente podrá:
        </p>
        <ul style={{ listStyle: "none", marginBottom: "var(--sp-5)", display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
          {(scopes.length > 0 ? scopes : ["(los permisos de tu rol)"]).map((scope) => (
            <li key={scope} style={{ fontSize: "var(--t-sm)", color: "var(--text)" }}>
              ✓ {SCOPE_LABELS[scope] ?? scope}
            </li>
          ))}
        </ul>

        <p style={{ fontSize: "var(--t-xs)", color: "var(--text-soft)", marginBottom: "var(--sp-4)" }}>
          Solo se concederán los permisos que tu rol permita. Las acciones sensibles
          (pujar, pagar) seguirán pidiendo tu confirmación en el agente.
        </p>

        {error && (
          <p style={{ color: "var(--danger)", fontSize: "var(--t-sm)", marginBottom: "var(--sp-3)" }}>{error}</p>
        )}

        <div style={{ display: "flex", gap: "var(--sp-3)", justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={deny} disabled={busy}>
            Denegar
          </Button>
          <Button onClick={approve} disabled={busy}>
            {busy ? "Autorizando…" : "Autorizar"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
