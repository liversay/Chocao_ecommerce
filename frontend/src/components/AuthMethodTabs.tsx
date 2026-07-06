interface Props {
  active: "otp" | "password";
  onChange: (mode: "otp" | "password") => void;
}

export default function AuthMethodTabs({ active, onChange }: Props) {
  const tabs = [
    { id: "otp" as const, label: "Código por email" },
    { id: "password" as const, label: "Contraseña" },
  ];

  return (
    <div
      style={{
        display: "flex",
        gap: "var(--sp-5)",
        borderBottom: "1px solid var(--border)",
        marginBottom: "var(--sp-5)",
      }}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: active === t.id ? "2px solid var(--primary)" : "2px solid transparent",
            marginBottom: "-1px",
            padding: "0 0 10px",
            color: active === t.id ? "var(--primary)" : "var(--text-muted)",
            fontSize: "var(--t-sm)",
            fontWeight: active === t.id ? 600 : 500,
            cursor: "pointer",
            transition: "color var(--dur), border-color var(--dur)",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
