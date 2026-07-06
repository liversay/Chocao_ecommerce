import React, { useState } from "react";

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "danger" | "ghost" | "accent";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  children: React.ReactNode;
}

const sizeMap = {
  sm: { padding: "8px 16px", fontSize: "var(--t-xs)" },
  md: { padding: "11px 22px", fontSize: "var(--t-sm)" },
  lg: { padding: "14px 28px", fontSize: "var(--t-base)" },
};

const variantStyles = {
  primary: {
    bg: "var(--surface)",
    color: "var(--primary)",
    weight: 700,
  },
  accent: {
    bg: "var(--surface)",
    color: "var(--accent)",
    weight: 700,
  },
  danger: {
    bg: "var(--surface)",
    color: "var(--danger)",
    weight: 600,
  },
  ghost: {
    bg: "var(--surface)",
    color: "var(--text-muted)",
    weight: 500,
  },
};

export default function GlassButton({
  variant = "primary",
  size = "md",
  fullWidth = false,
  disabled,
  style,
  children,
  ...props
}: Props) {
  const [pressed, setPressed] = useState(false);
  const [hover, setHover] = useState(false);
  const v = variantStyles[variant];

  const shadow = disabled
    ? "var(--nm-flat)"
    : pressed
    ? "var(--nm-in-sm)"
    : hover
    ? "var(--nm-out-md)"
    : "var(--nm-out-sm)";

  return (
    <button
      {...props}
      disabled={disabled}
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseEnter={() => !disabled && setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setPressed(false);
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        background: v.bg,
        color: v.color,
        fontWeight: v.weight,
        borderRadius: "var(--radius-md)",
        boxShadow: shadow,
        letterSpacing: "0.01em",
        transition: "box-shadow 0.18s ease, transform 0.1s ease, color 0.15s",
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        width: fullWidth ? "100%" : "auto",
        whiteSpace: "nowrap",
        ...sizeMap[size],
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export const NeumorphicButton = GlassButton;
