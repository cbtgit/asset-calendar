import { useState, type FormEvent } from "react";
import { Button } from "@/components/base/Button";
import { NumberField } from "@/components/base/NumberField";
import { normalizeLocalizedNumber } from "@/components/base/NumberField.utils";
import "./booking-type-form.css";

export function BookingTypeForm({ onCancel }: { onCancel: () => void }) {
  const [bookingType, setBookingType] = useState("");
  const [hourlyPrice, setHourlyPrice] = useState("");
  const [priceError, setPriceError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!normalizeLocalizedNumber(hourlyPrice)) {
      setPriceError("Enter a valid hourly price, such as 12.50 or 12,50.");
      setSubmitted(false);
      return;
    }

    setPriceError("");
    setSubmitted(true);
  }

  return (
    <section className="booking-type-form-surface" aria-labelledby="booking-type-form-title">
      <p className="eyebrow">Administration</p>
      <h1 id="booking-type-form-title">New Booking Type</h1>
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
          <Button type="submit" variant="primary">
            Create booking type
          </Button>
        </div>
        <p className="booking-type-form-announcement" aria-live="polite">
          {submitted ? "Booking type details are ready to save." : ""}
        </p>
      </form>
    </section>
  );
}
