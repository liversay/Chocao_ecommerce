import React from "react";

interface Props {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  variant?: "raised" | "inset" | "flat";
  interactive?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

const padMap = {
  none: 0,
  sm: "var(--sp-4)",
  md: "var(--sp-5)",
  lg: "var(--sp-6)",
};

/**
 * Backwards-compatible name (GlassCard) — now a Neumorphic surface.
 */
export default function GlassCard({
  children,
  className = "",
  style,
  variant = "raised",
  interactive = false,
  padding = "md",
}: Props) {
  const shadow =
    variant === "raised"
      ? "var(--nm-out-md)"
      : variant === "inset"
      ? "var(--nm-in-md)"
      : "var(--nm-flat)";

  return (
    <div
      className={className}
      style={{
        background: "var(--surface)",
        borderRadius: "var(--radius-lg)",
        boxShadow: shadow,
        padding: padMap[padding],
        transition: "box-shadow 0.25s ease, transform 0.2s ease",
        ...(interactive && { cursor: "pointer" }),
        ...style,
      }}
      onMouseEnter={
        interactive
          ? (e) => {
              (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--nm-out-lg)";
              (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
            }
          : undefined
      }
      onMouseLeave={
        interactive
          ? (e) => {
              (e.currentTarget as HTMLDivElement).style.boxShadow = shadow;
              (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}

// Alias for new naming
export const NeumorphicCard = GlassCard;
