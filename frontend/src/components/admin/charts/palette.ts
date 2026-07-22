import type React from "react";

// Colores hexadecimales literales — un <svg> de Recharts no puede leer
// custom properties de CSS. Estos valores son exactamente los del tema
// oscuro del admin (frontend/src/index.css, bloque .admin-theme).
export const CHART_COLORS = {
  bg: "#0f172a",
  surface: "#1e293b",
  border: "#334155",
  textMuted: "#94a3b8",
  text: "#e2e8f0",
  primary: "#3b82f6",
  accent: "#f2b84b",
  success: "#34d399",
  danger: "#f87171",
} as const;

export const STATUS_COLORS: Record<string, string> = {
  draft: CHART_COLORS.textMuted,
  published: CHART_COLORS.primary,
  active: CHART_COLORS.success,
  closed: CHART_COLORS.danger,
  awarded: CHART_COLORS.accent,
};

export const chartTooltipStyle: React.CSSProperties = {
  background: CHART_COLORS.surface,
  border: `1px solid ${CHART_COLORS.border}`,
  borderRadius: 8,
  fontSize: 12,
  color: CHART_COLORS.text,
};
