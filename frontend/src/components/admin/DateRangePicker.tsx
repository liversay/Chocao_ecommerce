interface Range {
  from: string;
  to: string;
}

interface Props {
  from: string;
  to: string;
  onChange: (range: Range) => void;
}

export default function DateRangePicker({ from, to, onChange }: Props) {
  return (
    <div style={{ display: "flex", gap: "var(--sp-2)", alignItems: "center" }}>
      <input
        type="date"
        className="input"
        value={from}
        max={to || undefined}
        onChange={(e) => onChange({ from: e.target.value, to })}
        style={{ width: 152 }}
      />
      <span className="text-soft" style={{ fontSize: "var(--t-xs)" }}>a</span>
      <input
        type="date"
        className="input"
        value={to}
        min={from || undefined}
        onChange={(e) => onChange({ from, to: e.target.value })}
        style={{ width: 152 }}
      />
    </div>
  );
}
