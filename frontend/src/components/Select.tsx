import React, { useId } from "react";

interface Props extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export default function Select({ label, error, options, className = "", id, ...props }: Props) {
  // Asociar label ↔ select (accesibilidad; también habilita getByLabel en E2E)
  const autoId = useId();
  const selectId = id ?? autoId;

  return (
    <div className="field">
      {label && (
        <label className="field-label" htmlFor={selectId}>
          {label}
        </label>
      )}
      <div className="select-wrap">
        <select id={selectId} className={`select ${error ? "input-error" : ""} ${className}`} {...props}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="select-arrow">▼</span>
      </div>
      {error && <span className="field-error-msg">{error}</span>}
    </div>
  );
}
