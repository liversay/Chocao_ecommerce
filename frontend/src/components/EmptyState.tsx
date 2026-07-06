import React from "react";

interface Props {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon = "📋", title, description, action }: Props) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "var(--sp-7) var(--sp-5)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--sp-3)",
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: "var(--bg-alt)",
          border: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.8rem",
          marginBottom: "var(--sp-2)",
        }}
      >
        {icon}
      </div>
      <h3 style={{ fontSize: "var(--t-md)", color: "var(--text)" }}>{title}</h3>
      {description && (
        <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)", maxWidth: 380 }}>
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: "var(--sp-3)" }}>{action}</div>}
    </div>
  );
}
