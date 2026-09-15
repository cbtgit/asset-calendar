import { useState, type FormEvent } from "react";
import type { BookingType } from "@/api/booking-types";
import { Button } from "@/components/base/Button";
import { NumberField } from "@/components/base/NumberField";
import { toMinorUnits } from "@/components/base/NumberField.utils";
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
};

export function BookingTypeForm({
  mode = "create",
  initialBookingType,
  onCancel,
  onSuccess,
}: BookingTypeFormProps) {
  const [bookingType, setBookingType] = useState(initialBookingType?.name ?? "");
  const [hourlyPrice, setHourlyPrice] = useState(
    initialBookingType ? String(initialBookingType.surcharge_minor_units / 100) : "",
  );
  const [priceError, setPriceError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const createMutation = useCreateBookingTypeMutation();
  const updateMutation = useUpdateBookingTypeMutation();
  const mutation = mode === "edit" ? updateMutation : createMutation;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const surchargeMinorUnits = toMinorUnits(hourlyPrice);
    if (surchargeMinorUnits === undefined) {
      setPriceError("Enter a valid hourly price, such as 12.50 or 12,50.");
      setSubmitted(false);
      return;
    }
    setPriceError("");
    setSubmitted(false);
    const input = { name: bookingType, surchargeMinorUnits };
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
      <form className="booking-type-form" onSubmit={submit}>
        <label htmlFor="booking-type-name">Booking type</label>
        <input
          id="booking-type-name"
          name="bookingType"
          value={bookingType}
          required
          maxLength={200}
          onChange={(event) => setBookingType(event.target.value)}
        />
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
        {mutation.error ? (
          <p role="alert" className="booking-type-form-error">
            {mutation.error.message}
          </p>
        ) : null}
        <p className="booking-type-form-announcement" aria-live="polite">
          {submitted ? "Booking type details are ready to save." : ""}
        </p>
      </form>
    </section>
  );
}
