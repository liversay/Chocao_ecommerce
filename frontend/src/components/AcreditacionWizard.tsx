import { useState } from "react";
import { useApi } from "../hooks/useApi";
import Button from "./Button";
import Input from "./Input";

type Step = "documento" | "verificando" | "pliego" | "listo" | "rechazado";

interface Props {
  onCompletado: () => void;
}

export default function AcreditacionWizard({ onCompletado }: Props) {
  const api = useApi();
  const [step, setStep] = useState<Step>("documento");
  const [documento, setDocumento] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState("");

  async function handleGuardarDocumento(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/api/acreditacion", { documento });
      setStep("pliego");
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "No pudimos validar tu documento");
    } finally {
      setLoading(false);
    }
  }

  async function handleAceptarPliego() {
    setError("");
    setLoading(true);
    try {
      await api.patch("/api/acreditacion/pliego", { aceptoPliego: true });
      setStep("verificando");
      const { data } = await api.post("/api/acreditacion/enviar");
      if (data.estado === "ACREDITADO") {
        setStep("listo");
        onCompletado();
      } else {
        setMotivoRechazo(data.motivoRechazo || "");
        setStep("rechazado");
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "No pudimos completar la verificación");
      setStep("pliego");
    } finally {
      setLoading(false);
    }
  }

  if (step === "documento") {
    return (
      <form onSubmit={handleGuardarDocumento} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
        <h3 style={{ fontSize: "var(--t-lg)" }}>Acreditación de proponente</h3>
        <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)" }}>
          Para pujar en subastas de bienes aprehendidos necesitas acreditarte con tu documento de identidad.
        </p>
        <Input
          label="Documento de identidad (cédula o pasaporte)"
          value={documento}
          onChange={(e) => setDocumento(e.target.value)}
          placeholder="8-888-8888"
          required
          autoFocus
        />
        {error && <p style={{ color: "var(--danger)", fontSize: "var(--t-xs)" }}>{error}</p>}
        <Button type="submit" variant="primary" fullWidth disabled={loading || !documento}>
          {loading ? "Validando..." : "Continuar"}
        </Button>
      </form>
    );
  }

  if (step === "pliego") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
        <h3 style={{ fontSize: "var(--t-lg)" }}>Pliego de cargos</h3>
        <div style={{ maxHeight: 180, overflowY: "auto", fontSize: "var(--t-xs)", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "var(--sp-3)" }}>
          Los vehículos se subastan "en el estado en que se encuentran", sin garantía de funcionamiento
          ni saneamiento por vicios ocultos. Al aceptar, declaras haber leído y aceptado esta condición.
        </div>
        {error && <p style={{ color: "var(--danger)", fontSize: "var(--t-xs)" }}>{error}</p>}
        <Button variant="primary" fullWidth onClick={handleAceptarPliego} disabled={loading}>
          {loading ? "Procesando..." : "Acepto y continúo"}
        </Button>
      </div>
    );
  }

  if (step === "verificando") {
    return <p style={{ textAlign: "center", color: "var(--text-muted)" }}>Verificando tu identidad...</p>;
  }

  if (step === "rechazado") {
    return (
      <div style={{ textAlign: "center" }}>
        <p style={{ color: "var(--danger)", fontWeight: 600 }}>No pudimos acreditarte</p>
        <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)" }}>Motivo: {motivoRechazo || "verificación fallida"}</p>
        <Button variant="ghost" onClick={() => setStep("documento")}>Corregir e intentar de nuevo</Button>
      </div>
    );
  }

  return <p style={{ textAlign: "center", color: "var(--success)" }}>¡Acreditación completada! Ya puedes pujar.</p>;
}
