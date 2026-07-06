import React from "react";

interface Props extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export default function NeumorphicSelect({ label, options, style, ...props }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
      {label && (
        <label
          style={{
            fontSize: "var(--t-xs)",
            fontWeight: 600,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {label}
        </label>
      )}
      <div style={{ position: "relative" }}>
        <select
          {...props}
          style={{
            appearance: "none",
            WebkitAppearance: "none",
            background: "var(--surface)",
            border: "none",
            color: "var(--text)",
            fontSize: "var(--t-base)",
            fontWeight: 500,
            padding: "13px 40px 13px 16px",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--nm-in-sm)",
            width: "100%",
            cursor: "pointer",
            ...style,
          }}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span
          style={{
            position: "absolute",
            right: 16,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-soft)",
            pointerEvents: "none",
            fontSize: "0.7rem",
          }}
        >
          ▼
        </span>
      </div>
    </div>
  );
}
