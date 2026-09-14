import { useState, type FormEvent } from "react";
import type { BookingType } from "@/api/booking-types";
import { useUpdateBookingTypeMutation } from "@/hooks/use-booking-types";

function money(value: number, locale: string, currency: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value / 100);
}

function parseMinorUnits(value: string, locale: string): number | undefined {
  const decimal =
    new Intl.NumberFormat(locale).formatToParts(1.1).find((part) => part.type === "decimal")
      ?.value ?? ".";
  const normalized = value.trim().replace(/\s/g, "").replace(decimal, ".");
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) return undefined;
  const amount = Number(normalized);
  return Number.isSafeInteger(Math.round(amount * 100)) ? Math.round(amount * 100) : undefined;
}

export function BookingTypeRow({
  type,
  locale,
  currency,
  onArchive,
}: {
  type: BookingType;
  locale: string;
  currency: string;
  onArchive: (type: BookingType) => void;
}) {
  const update = useUpdateBookingTypeMutation();
  const [value, setValue] = useState((type.surcharge_minor_units / 100).toFixed(2));
  const [validationError, setValidationError] = useState("");
  const editable = type.system_kind === "custom" && !type.archived;
  const save = (event: FormEvent) => {
    event.preventDefault();
    const surcharge = parseMinorUnits(value, locale);
    if (surcharge === undefined) {
      setValidationError("Enter a non-negative amount with up to two decimal places.");
      return;
    }
    setValidationError("");
    update.mutate({ id: type.id, input: { surcharge_minor_units: surcharge } });
  };
  return (
    <li className="booking-types-row">
      <div>
        <strong>{type.name}</strong>
        <span className="booking-types-meta">
          {type.system_kind === "custom" ? "Custom" : "System"}
          {type.archived ? " · Archived" : ""}
        </span>
      </div>
      <span>{money(type.surcharge_minor_units, locale, currency)}</span>
      {renderActions({
        type,
        value,
        editable,
        pending: update.isPending,
        error: update.isError ? update.error.message : undefined,
        validationError,
        onSubmit: save,
        onChange: (nextValue) => {
          setValue(nextValue);
          setValidationError("");
        },
        onArchive,
      })}
    </li>
  );
}

function renderActions({
  type,
  value,
  editable,
  pending,
  error,
  validationError,
  onSubmit,
  onChange,
  onArchive,
}: {
  type: BookingType;
  value: string;
  editable: boolean;
  pending: boolean;
  error?: string;
  validationError: string;
  onSubmit: (event: FormEvent) => void;
  onChange: (value: string) => void;
  onArchive: (type: BookingType) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="booking-types-actions" noValidate>
      {editable ? (
        <>
          <label className="sr-only" htmlFor={`surcharge-${type.id}`}>
            Surcharge for {type.name}
          </label>
          <input
            id={`surcharge-${type.id}`}
            inputMode="decimal"
            value={value}
            aria-label={`Surcharge for ${type.name}`}
            onChange={(event) => onChange(event.target.value)}
            disabled={pending}
          />
          <button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            className="booking-types-danger"
            onClick={() => onArchive(type)}
            disabled={pending}
          >
            Archive
          </button>
        </>
      ) : (
        <span className="booking-types-protected">{type.archived ? "Archived" : "Protected"}</span>
      )}
      {validationError ? <span role="alert">{validationError}</span> : null}
      {error ? <span role="alert">{error}</span> : null}
    </form>
  );
}
