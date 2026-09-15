import type { ComponentPropsWithRef } from "react";
import "./NumberField.css";

export type NumberFieldProps = Omit<ComponentPropsWithRef<"input">, "inputMode" | "type"> & {
  error?: string;
  label: string;
};

export function NumberField({ error, id, label, ...props }: NumberFieldProps) {
  const errorId = `${id}-error`;
  const describedBy = [props["aria-describedby"], error ? errorId : undefined]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="number-field">
      <label className="number-field-label" htmlFor={id}>
        {label}
      </label>
      <input
        {...props}
        id={id}
        type="text"
        inputMode="decimal"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
      />
      {error ? (
        <p id={errorId} className="number-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
