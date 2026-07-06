interface Props {
  active: "otp" | "password";
  onChange: (mode: "otp" | "password") => void;
}

export default function AuthMethodTabs({ active, onChange }: Props) {
  const tabs = [
    { id: "otp" as const, label: "📧 Código por email", desc: "Sin contraseña" },
    { id: "password" as const, label: "🔑 Contraseña", desc: "Método tradicional" },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "8px",
        padding: "5px",
        background: "var(--surface)",
        boxShadow: "var(--nm-in-sm)",
        borderRadius: "var(--radius-md)",
        marginBottom: "var(--sp-4)",
      }}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            background: active === t.id ? "var(--surface)" : "transparent",
            boxShadow: active === t.id ? "var(--nm-out-sm)" : "none",
            border: "none",
            padding: "10px 12px",
            borderRadius: "var(--radius-sm)",
            color: active === t.id ? "var(--primary)" : "var(--text-muted)",
            fontSize: "var(--t-xs)",
            fontWeight: active === t.id ? 700 : 500,
            cursor: "pointer",
            transition: "all 0.15s",
            textAlign: "center",
            lineHeight: 1.3,
          }}
        >
          <div>{t.label}</div>
        </button>
      ))}
    </div>
  );
}
