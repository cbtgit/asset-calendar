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
  const form = useBookingTypeRowState(type, locale);
  const editable = isEditable(type);
  const formId = `booking-type-actions-${type.id}`;
  return (
    <li className="booking-types-row">
      <div>
        {editable ? (
          <input
            form={formId}
            aria-label={`Name for ${type.name}`}
            value={form.name}
            onChange={(event) => form.onNameChange(event.target.value)}
            disabled={form.update.isPending}
            aria-invalid={form.validationField === "name" || Boolean(form.mutationError)}
            aria-describedby={form.nameDescribedBy || undefined}
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
        value: form.value,
        editable,
        archivable: editable && type.system_kind === "custom",
        pending: form.update.isPending,
        validationError: form.validationError,
        validationField: form.validationField,
        surchargeErrorId: form.surchargeErrorId,
        mutationErrorId: form.mutationErrorId,
        mutationError: form.mutationError,
        onSubmit: form.save,
        onChange: form.onValueChange,
        onArchive,
      })}
    </li>
  );
}

function isEditable(type: BookingType) {
  return (type.system_kind === "custom" || type.system_kind === "training") && !type.archived;
}

function useBookingTypeRowState(type: BookingType, locale: string) {
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
    const previous = previousTypeRef.current;
    const authoritativeTypeChanged =
      previous.id !== type.id ||
      previous.name !== type.name ||
      previous.surcharge !== type.surcharge_minor_units ||
      previous.archived !== type.archived;
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
  const surchargeErrorId = `booking-type-surcharge-error-${type.id}`;
  const mutationErrorId = `booking-type-mutation-error-${type.id}`;
  const mutationError = update.isError
    ? mutationErrorMessage(update.error, "booking-type-save")
    : "";
  return {
    update,
    name,
    value,
    validationError,
    validationField,
    surchargeErrorId,
    mutationErrorId,
    mutationError,
    nameDescribedBy: [
      validationField === "name" ? `booking-type-name-error-${type.id}` : "",
      mutationError ? mutationErrorId : "",
    ]
      .filter(Boolean)
      .join(" "),
    save,
    onNameChange: (nextName: string) => {
      setDirty(true);
      setName(nextName);
      setValidationError("");
      setValidationField(null);
    },
    onValueChange: (nextValue: string) => {
      setDirty(true);
      setValue(nextValue);
      setValidationError("");
      setValidationField(null);
    },
  };
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
