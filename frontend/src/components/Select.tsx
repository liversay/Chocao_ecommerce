import React from "react";

interface Props extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export default function Select({ label, error, options, className = "", ...props }: Props) {
  return (
    <div className="field">
      {label && <label className="field-label">{label}</label>}
      <div className="select-wrap">
        <select className={`select ${error ? "input-error" : ""} ${className}`} {...props}>
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
