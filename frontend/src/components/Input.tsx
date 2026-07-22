import React, { useId } from "react";

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export default function Input({ label, error, hint, className = "", id, ...props }: Props) {
  // Asociar label ↔ input (accesibilidad; también habilita getByLabel en E2E)
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <div className="field">
      {label && (
        <label className="field-label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <input id={inputId} className={`input ${error ? "input-error" : ""} ${className}`} {...props} />
      {error && <span className="field-error-msg">{error}</span>}
      {!error && hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}
