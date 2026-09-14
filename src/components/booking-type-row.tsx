import { useEffect, useRef, useState, type FormEvent } from "react";
import type { BookingType } from "@/api/booking-types";
import { useUpdateBookingTypeMutation } from "@/hooks/use-booking-types";
import { formatMoney, formatMoneyInput, parseMoney } from "@/lib/money";
import { mutationErrorMessage } from "@/lib/error-messages";

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
  const [dirty, setDirty] = useState(false);
  const previousTypeRef = useRef({
    id: type.id,
    name: type.name,
    surcharge: type.surcharge_minor_units,
    archived: type.archived,
  });
  useEffect(() => {
    const authoritativeTypeChanged =
      previousTypeRef.current.id !== type.id ||
      previousTypeRef.current.name !== type.name ||
      previousTypeRef.current.surcharge !== type.surcharge_minor_units ||
      previousTypeRef.current.archived !== type.archived;
    previousTypeRef.current = {
      id: type.id,
      name: type.name,
      surcharge: type.surcharge_minor_units,
      archived: type.archived,
    };
    if (!dirty || authoritativeTypeChanged) {
      setName(type.name);
      setValue(formatMoneyInput(type.surcharge_minor_units, locale));
      if (authoritativeTypeChanged) setDirty(false);
    }
  }, [dirty, locale, type]);
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
  const formId = `booking-type-actions-${type.id}`;
  return (
    <li className="booking-types-row">
      <div>
        {editable ? (
          <input
            form={formId}
            aria-label={`Name for ${type.name}`}
            value={name}
            onChange={(event) => {
              setDirty(true);
              setName(event.target.value);
            }}
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
        formId,
        value,
        editable,
        archivable: editable && type.system_kind === "custom",
        pending: update.isPending,
        error: update.isError ? update.error : undefined,
        validationError,
        onSubmit: save,
        onChange: (nextValue) => {
          setDirty(true);
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
  formId,
  value,
  editable,
  archivable,
  pending,
  error,
  validationError,
  onSubmit,
  onChange,
  onArchive,
}: {
  type: BookingType;
  formId: string;
  value: string;
  editable: boolean;
  archivable: boolean;
  pending: boolean;
  error?: unknown;
  validationError: string;
  onSubmit: (event: FormEvent) => void;
  onChange: (value: string) => void;
  onArchive: (type: BookingType) => void;
}) {
  return (
    <form id={formId} onSubmit={onSubmit} className="booking-types-actions" noValidate>
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
          {archivable ? (
            <button
              type="button"
              className="booking-types-danger"
              onClick={() => onArchive(type)}
              disabled={pending}
            >
              Archive
            </button>
          ) : null}
        </>
      ) : (
        <span className="booking-types-protected">{type.archived ? "Archived" : "Protected"}</span>
      )}
      {validationError ? <span role="alert">{validationError}</span> : null}
      {error ? <span role="alert">{mutationErrorMessage(error, "booking-type-save")}</span> : null}
    </form>
  );
}
