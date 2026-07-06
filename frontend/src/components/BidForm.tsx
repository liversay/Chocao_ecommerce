import { useState } from "react";
import GlassInput from "./GlassInput";
import GlassButton from "./GlassButton";

interface Props {
  currentPrice: number;
  onSubmit: (amount: number) => Promise<void>;
  disabled?: boolean;
}

export default function BidForm({ currentPrice, onSubmit, disabled }: Props) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const min = currentPrice + 1;
  const suggestions = [
    Math.round(currentPrice * 1.05),
    Math.round(currentPrice * 1.10),
    Math.round(currentPrice * 1.20),
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= currentPrice) {
      setError(`La puja debe ser mayor a $${currentPrice.toLocaleString()}`);
      return;
    }
    setError("");
    setLoading(true);
    try {
      await onSubmit(parsed);
      setAmount("");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || "Error al registrar la puja");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
      <GlassInput
        label="Tu puja (USD)"
        type="number"
        min={min}
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder={`Mínimo $${min.toLocaleString()}`}
        error={error}
        hint={!error ? "Tu puja debe superar la oferta actual" : undefined}
        disabled={disabled || loading}
      />

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setAmount(String(s))}
            style={{
              background: "var(--surface)",
              boxShadow: "var(--nm-flat)",
              borderRadius: "var(--radius-pill)",
              padding: "5px 13px",
              fontSize: "var(--t-xs)",
              color: "var(--text-muted)",
              fontWeight: 600,
              cursor: "pointer",
              transition: "box-shadow 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "var(--nm-out-sm)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "var(--nm-flat)";
            }}
          >
            +${s.toLocaleString()}
          </button>
        ))}
      </div>

      <GlassButton type="submit" variant="accent" disabled={disabled || loading} fullWidth size="lg">
        {loading ? "Enviando..." : "Realizar puja"}
      </GlassButton>
    </form>
  );
}
