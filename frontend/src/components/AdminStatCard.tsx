interface Props {
  icon?: string;
  label: string;
  value: string | number;
  hint?: string;
}

export default function AdminStatCard({ icon, label, value, hint }: Props) {
  return (
    <div className="kpi">
      {icon && <p style={{ fontSize: "1rem", marginBottom: 4 }}>{icon}</p>}
      <p className="kpi-value">{value}</p>
      <p className="kpi-label">{label}</p>
      {hint && <p style={{ fontSize: "10.5px", color: "var(--text-soft)", marginTop: 4 }}>{hint}</p>}
    </div>
  );
}
