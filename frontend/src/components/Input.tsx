import React from "react";

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export default function Input({ label, error, hint, className = "", ...props }: Props) {
  return (
    <div className="field">
      {label && <label className="field-label">{label}</label>}
      <input className={`input ${error ? "input-error" : ""} ${className}`} {...props} />
      {error && <span className="field-error-msg">{error}</span>}
      {!error && hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}
