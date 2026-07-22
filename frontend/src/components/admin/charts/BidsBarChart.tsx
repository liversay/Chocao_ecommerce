import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_COLORS, chartTooltipStyle } from "./palette";

interface Props {
  data: { date: string; value: number }[];
}

export default function BidsBarChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} vertical={false} />
        <XAxis dataKey="date" stroke={CHART_COLORS.textMuted} fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke={CHART_COLORS.textMuted} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => [value, "Pujas"]} />
        <Bar dataKey="value" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
