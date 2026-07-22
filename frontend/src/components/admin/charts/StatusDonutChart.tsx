import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CHART_COLORS, chartTooltipStyle, STATUS_COLORS } from "./palette";

interface Props {
  data: { _id: string; count: number }[];
}

export default function StatusDonutChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="_id"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          stroke={CHART_COLORS.surface}
        >
          {data.map((entry) => (
            <Cell key={entry._id} fill={STATUS_COLORS[entry._id] ?? CHART_COLORS.textMuted} />
          ))}
        </Pie>
        <Tooltip contentStyle={chartTooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}
