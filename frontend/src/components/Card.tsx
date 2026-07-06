import React from "react";

interface Props {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  variant?: "default" | "elevated";
  interactive?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

export default function Card({
  children,
  className = "",
  style,
  variant = "default",
  interactive = false,
  padding = "md",
  onClick,
}: Props) {
  const cls = [
    "card",
    variant === "elevated" && "card-elevated",
    interactive && "card-interactive",
    `card-pad-${padding}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} style={style} onClick={onClick}>
      {children}
    </div>
  );
}
