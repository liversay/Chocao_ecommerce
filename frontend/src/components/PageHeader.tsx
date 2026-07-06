import React from "react";

interface Props {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
}

export default function PageHeader({ title, subtitle, actions, eyebrow }: Props) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        flexWrap: "wrap",
        gap: "var(--sp-4)",
        marginBottom: "var(--sp-6)",
      }}
    >
      <div>
        {eyebrow && (
          <p
            style={{
              fontSize: "var(--t-xs)",
              fontWeight: 700,
              color: "var(--accent)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: "var(--sp-2)",
            }}
          >
            {eyebrow}
          </p>
        )}
        <h1 style={{ fontSize: "var(--t-2xl)", color: "var(--text)" }}>{title}</h1>
        {subtitle && (
          <p style={{ color: "var(--text-muted)", marginTop: 6, fontSize: "var(--t-sm)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div style={{ display: "flex", gap: "var(--sp-3)" }}>{actions}</div>}
    </div>
  );
}
