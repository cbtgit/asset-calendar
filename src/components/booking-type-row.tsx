import { useEffect, useRef, useState, type FormEvent } from "react";
import type { BookingType } from "@/api/booking-types";
import { useUpdateBookingTypeMutation } from "@/hooks/use-booking-types";
import { formatMoney, formatMoneyInput, parseMoney } from "@/lib/money";
import { mutationErrorMessage } from "@/lib/error-messages";

// oxlint-disable-next-line complexity, max-lines-per-function
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
  const [validationField, setValidationField] = useState<"name" | "surcharge" | null>(null);
  const [dirty, setDirty] = useState(false);
  const valueLocaleRef = useRef(locale);
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
      valueLocaleRef.current = locale;
      if (authoritativeTypeChanged) setDirty(false);
    }
  }, [dirty, locale, type]);
  const editable =
    (type.system_kind === "custom" || type.system_kind === "training") && !type.archived;
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setValidationError("Enter a booking type name.");
      setValidationField("name");
      return;
    }
    const parsed = parseMoney(value, valueLocaleRef.current);
    if ("error" in parsed) {
      setValidationError("Enter a non-negative amount with up to two decimal places.");
      setValidationField("surcharge");
      return;
    }
    setValidationError("");
    setValidationField(null);
    update.mutate({
      id: type.id,
      input: { name: name.trim(), surcharge_minor_units: parsed.value },
    });
  };
  const formId = `booking-type-actions-${type.id}`;
  const nameErrorId = `booking-type-name-error-${type.id}`;
  const surchargeErrorId = `booking-type-surcharge-error-${type.id}`;
  const mutationErrorId = `booking-type-mutation-error-${type.id}`;
  const mutationError = update.isError
    ? mutationErrorMessage(update.error, "booking-type-save")
    : "";
  const nameDescribedBy = [
    validationField === "name" ? nameErrorId : "",
    mutationError ? mutationErrorId : "",
  ]
    .filter(Boolean)
    .join(" ");
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
              setValidationError("");
              setValidationField(null);
            }}
            disabled={update.isPending}
            aria-invalid={validationField === "name" || Boolean(mutationError)}
            aria-describedby={nameDescribedBy || undefined}
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
        validationError,
        validationField,
        surchargeErrorId,
        mutationErrorId,
        mutationError,
        onSubmit: save,
        onChange: (nextValue) => {
          setDirty(true);
          setValue(nextValue);
          setValidationError("");
          setValidationField(null);
        },
        onArchive,
      })}
    </li>
  );
}

// oxlint-disable-next-line complexity
function renderActions({
  type,
  formId,
  value,
  editable,
  archivable,
  pending,
  validationError,
  validationField,
  surchargeErrorId,
  mutationErrorId,
  mutationError,
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
  validationError: string;
  validationField: "name" | "surcharge" | null;
  surchargeErrorId: string;
  mutationErrorId: string;
  mutationError: string;
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
            aria-invalid={validationField === "surcharge" || Boolean(mutationError)}
            aria-describedby={
              [
                validationField === "surcharge" ? surchargeErrorId : "",
                mutationError ? mutationErrorId : "",
              ]
                .filter(Boolean)
                .join(" ") || undefined
            }
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
      {validationError ? (
        <span
          id={validationField === "name" ? `booking-type-name-error-${type.id}` : surchargeErrorId}
          role="alert"
        >
          {validationError}
        </span>
      ) : null}
      {mutationError ? (
        <span id={mutationErrorId} role="alert">
          {mutationError}
        </span>
      ) : null}
    </form>
  );
}
