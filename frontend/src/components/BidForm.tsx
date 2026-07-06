import { useState } from "react";
import Input from "./Input";
import Button from "./Button";

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
    { label: "+5%", value: Math.round(currentPrice * 1.05) },
    { label: "+10%", value: Math.round(currentPrice * 1.10) },
    { label: "+20%", value: Math.round(currentPrice * 1.20) },
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
      <Input
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

      <div style={{ display: "flex", gap: "8px" }}>
        {suggestions.map((s) => (
          <Button
            key={s.label}
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setAmount(String(s.value))}
            disabled={disabled || loading}
            style={{ flex: 1 }}
          >
            {s.label}
          </Button>
        ))}
      </div>

      <Button type="submit" variant="primary" fullWidth size="lg" disabled={disabled || loading}>
        {loading ? "Enviando..." : "Pujar"}
      </Button>
    </form>
  );
}
