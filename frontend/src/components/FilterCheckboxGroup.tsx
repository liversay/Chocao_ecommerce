// Grupo de checkboxes reutilizable para paneles de filtro (catálogo público y
// backoffice). Extraído de CatalogFilters para compartirlo entre pantallas.
interface Props {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  scroll?: boolean;
}

export default function FilterCheckboxGroup({ options, selected, onToggle, scroll }: Props) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--sp-2) var(--sp-3)",
        marginTop: 6,
        ...(scroll
          ? {
              maxHeight: 160,
              overflowY: "auto",
              padding: "var(--sp-2) var(--sp-3)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
            }
          : {}),
      }}
    >
      {options.map((o) => (
        <label
          key={o.value}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: "var(--t-sm)",
            color: "var(--text)",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          <input type="checkbox" checked={selected.includes(o.value)} onChange={() => onToggle(o.value)} />
          {o.label}
        </label>
      ))}
    </div>
  );
}
