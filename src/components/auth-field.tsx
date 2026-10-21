import type { InputHTMLAttributes } from "react";

type AuthFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  hint?: string;
  id: string;
  label: string;
};

export function AuthField({ hint, id, label, ...inputProps }: AuthFieldProps) {
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      {hint ? (
        <span className="auth-field-hint" id={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
      <input
        id={id}
        aria-describedby={hint ? `${id}-hint` : inputProps["aria-describedby"]}
        {...inputProps}
      />
    </div>
  );
}
