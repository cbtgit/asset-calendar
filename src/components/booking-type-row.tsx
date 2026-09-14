import { useState, type FormEvent } from "react";
import type { BookingType } from "@/api/booking-types";
import { useUpdateBookingTypeMutation } from "@/hooks/use-booking-types";
import { formatMoney, formatMoneyInput, parseMoney } from "@/lib/money";

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
  const [name, setName] = useState(type.name);
  const [value, setValue] = useState(() => formatMoneyInput(type.surcharge_minor_units, locale));
  const [validationError, setValidationError] = useState("");
  const editable =
    (type.system_kind === "custom" || type.system_kind === "training") && !type.archived;
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setValidationError("Enter a booking type name.");
      return;
    }
    const parsed = parseMoney(value, locale);
    if ("error" in parsed) {
      setValidationError("Enter a non-negative amount with up to two decimal places.");
      return;
    }
    setValidationError("");
    update.mutate({
      id: type.id,
      input: { name: name.trim(), surcharge_minor_units: parsed.value },
    });
  };
  return (
    <li className="booking-types-row">
      <div>
        {editable ? (
          <input
            aria-label={`Name for ${type.name}`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={update.isPending}
          />
        ) : (
          <strong>{type.name}</strong>
        )}
        <span className="booking-types-meta">
          {type.system_kind === "custom" ? "Custom" : "System"}
          {type.archived ? " · Archived" : ""}
        </span>
      </div>
      <span>{formatMoney(type.surcharge_minor_units, locale, currency)}</span>
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
