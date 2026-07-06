interface Props {
  label: string;
  value: string | number;
  icon: string;
  trend?: string;
  accent?: "primary" | "accent" | "success" | "danger";
}

const accentMap = {
  primary: "var(--primary)",
  accent: "var(--accent)",
  success: "var(--success)",
  danger: "var(--danger)",
};

export default function AdminStatCard({ label, value, icon, trend, accent = "primary" }: Props) {
  const color = accentMap[accent];

  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--nm-out-md)",
        padding: "var(--sp-5)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-3)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            boxShadow: "var(--nm-in-sm)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.2rem",
            color,
          }}
        >
          {icon}
        </div>
        {trend && (
          <span
            style={{
              fontSize: "var(--t-xs)",
              fontWeight: 600,
              color: "var(--success)",
              padding: "3px 10px",
              borderRadius: "var(--radius-pill)",
              background: "var(--success-soft)",
            }}
          >
            {trend}
          </span>
        )}
      </div>
      <div>
        <p
          style={{
            fontSize: "var(--t-xs)",
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            fontWeight: 600,
            marginBottom: 4,
          }}
        >
          {label}
        </p>
        <p
          style={{
            fontSize: "var(--t-2xl)",
            fontWeight: 700,
            color: "var(--text)",
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

export const StatCard = AdminStatCard;
