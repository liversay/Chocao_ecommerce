import React, { useState } from "react";

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export default function GlassInput({ label, error, hint, style, ...props }: Props) {
  const [focused, setFocused] = useState(false);

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
      <input
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={{
          background: "var(--surface)",
          border: "none",
          color: "var(--text)",
          fontSize: "var(--t-base)",
          fontWeight: 500,
          padding: "13px 16px",
          borderRadius: "var(--radius-md)",
          boxShadow: error
            ? "inset 2px 2px 5px rgba(155,44,44,0.25), inset -2px -2px 5px rgba(255,255,255,0.7)"
            : focused
            ? "var(--nm-in-md)"
            : "var(--nm-in-sm)",
          width: "100%",
          transition: "box-shadow 0.18s ease",
          ...style,
        }}
      />
      {error && (
        <span style={{ fontSize: "var(--t-xs)", color: "var(--danger)", fontWeight: 500 }}>
          {error}
        </span>
      )}
      {!error && hint && (
        <span style={{ fontSize: "var(--t-xs)", color: "var(--text-soft)" }}>{hint}</span>
      )}
    </div>
  );
}

export const NeumorphicInput = GlassInput;
