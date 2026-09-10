import type { InputHTMLAttributes } from "react";

type AuthFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  id: string;
  label: string;
};

export function AuthField({ id, label, ...inputProps }: AuthFieldProps) {
  return (
    <label htmlFor={id}>
      {label}
      <input id={id} {...inputProps} />
    </label>
  );
}
