import { useEffect, useRef, useState, type FormEvent } from "react";
import type { BookingType } from "@/api/booking-types";
import { ApplicationError } from "@/api/errors";
import { Button } from "@/components/base/Button";
import { NumberField } from "@/components/base/NumberField";
import { DEFAULT_NUMBER_LOCALE, toMinorUnits } from "@/components/base/NumberField.utils";
import "./booking-type-form.css";
import {
  useCreateBookingTypeMutation,
  useUpdateBookingTypeMutation,
} from "@/hooks/use-booking-types";

type BookingTypeFormProps = {
  mode?: "create" | "edit";
  initialBookingType?: BookingType;
  onCancel: () => void;
  onSuccess?: () => void;
  locale?: string;
};

function duplicateNameCode(error: ApplicationError): string | undefined {
  if (typeof error.cause !== "object" || error.cause === null) return undefined;

  const directData = Reflect.get(error.cause, "data");
  const response = Reflect.get(error.cause, "response");
  const data =
    typeof directData === "object" && directData !== null
      ? directData
      : typeof response === "object" && response !== null
        ? Reflect.get(response, "data")
        : undefined;
  if (typeof data !== "object" || data === null) return undefined;

  const field = Reflect.get(data, "name_normalized");
  if (typeof field !== "object" || field === null) return undefined;

  const code = Reflect.get(field, "code");
  return typeof code === "string" ? code : undefined;
}

function initialHourlyPrice(bookingType: BookingType | undefined, locale: string): string {
  if (!bookingType) return "";
  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(bookingType.surcharge_minor_units / 100);
  } catch {
    return String(bookingType.surcharge_minor_units / 100);
  }
}

export function BookingTypeForm({
  mode = "create",
  initialBookingType,
  onCancel,
  onSuccess,
  locale = DEFAULT_NUMBER_LOCALE,
}: BookingTypeFormProps) {
  const [bookingType, setBookingType] = useState(initialBookingType?.name ?? "");
  const [hourlyPrice, setHourlyPrice] = useState(initialHourlyPrice(initialBookingType, locale));
  const [nameError, setNameError] = useState("");
  const [priceError, setPriceError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const createMutation = useCreateBookingTypeMutation();
  const updateMutation = useUpdateBookingTypeMutation();
  const mutation = mode === "edit" ? updateMutation : createMutation;
  const conflictError =
    mutation.error instanceof ApplicationError &&
    (mutation.error.kind === "conflict" ||
      (mutation.error.kind === "validation" &&
        duplicateNameCode(mutation.error) === "validation_not_unique"))
      ? "A booking type with this name already exists."
      : undefined;

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNameError("");
    setSubmitted(false);
    const trimmedName = bookingType.trim();
    if (!trimmedName) {
      setNameError("Enter a booking type name.");
      nameRef.current?.focus();
      return;
    }

    const surchargeMinorUnits = toMinorUnits(hourlyPrice, locale);
    if (surchargeMinorUnits === undefined) {
      setPriceError("Enter a valid hourly price, such as 12.50 or 12,50.");
      setSubmitted(false);
      return;
    }
    setPriceError("");
    const input = { name: trimmedName, surchargeMinorUnits };
    if (mode === "edit" && initialBookingType) {
      updateMutation.mutate(
        { id: initialBookingType.id, input },
        { onSuccess: () => onSuccess?.() },
      );
    } else {
      createMutation.mutate(input, {
        onSuccess: () => {
          setSubmitted(true);
          onSuccess?.();
        },
      });
    }
  }

  return (
    <section className="booking-type-form-surface" aria-labelledby="booking-type-form-title">
      <p className="eyebrow">Administration</p>
      <h1 id="booking-type-form-title">
        {mode === "edit" ? "Edit Booking Type" : "New Booking Type"}
      </h1>
      <form className="booking-type-form" onSubmit={submit} noValidate>
        <label htmlFor="booking-type-name">Booking type</label>
        <input
          ref={nameRef}
          id="booking-type-name"
          name="bookingType"
          value={bookingType}
          maxLength={200}
          aria-invalid={Boolean(nameError || conflictError)}
          aria-describedby={nameError || conflictError ? "booking-type-name-error" : undefined}
          onChange={(event) => {
            setBookingType(event.target.value);
            setNameError("");
          }}
        />
        {nameError || conflictError ? (
          <p id="booking-type-name-error" className="booking-type-form-error" role="alert">
            {nameError || conflictError}
          </p>
        ) : null}
        <NumberField
          id="booking-type-hourly-price"
          label="Hourly price"
          name="hourlyPrice"
          value={hourlyPrice}
          required
          error={priceError || undefined}
          onChange={(event) => {
            setHourlyPrice(event.target.value);
            setPriceError("");
          }}
        />
        <div className="booking-type-form-actions">
          <Button type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
        {mutation.error && !conflictError ? (
          <p role="alert" className="booking-type-form-error">
            We could not save this booking type. Try again.
          </p>
        ) : null}
        <p className="booking-type-form-announcement" aria-live="polite">
          {submitted ? "Booking type details are ready to save." : ""}
        </p>
      </form>
    </section>
  );
}
