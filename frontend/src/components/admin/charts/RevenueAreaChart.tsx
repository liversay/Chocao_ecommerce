import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_COLORS, chartTooltipStyle } from "./palette";

interface Props {
  data: { date: string; value: number }[];
}

export default function RevenueAreaChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.accent} stopOpacity={0.35} />
            <stop offset="100%" stopColor={CHART_COLORS.accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} vertical={false} />
        <XAxis dataKey="date" stroke={CHART_COLORS.textMuted} fontSize={11} tickLine={false} axisLine={false} />
        <YAxis
          stroke={CHART_COLORS.textMuted}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => [`$${Number(value).toLocaleString()}`, "Ingresos"]} />
        <Area type="monotone" dataKey="value" stroke={CHART_COLORS.accent} strokeWidth={2} fill="url(#revenueFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
