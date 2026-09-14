import { useState, type FormEvent } from "react";
import { useCreateBookingTypeMutation } from "@/hooks/use-booking-types";

function parseMinorUnits(value: string, locale: string): number | undefined {
  const decimal =
    new Intl.NumberFormat(locale).formatToParts(1.1).find((part) => part.type === "decimal")
      ?.value ?? ".";
  const normalized = value.trim().replace(/\s/g, "").replace(decimal, ".");
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) return undefined;
  const amount = Number(normalized);
  return Number.isSafeInteger(Math.round(amount * 100)) ? Math.round(amount * 100) : undefined;
}

export function CreateBookingTypeForm({ locale }: { locale: string }) {
  const mutation = useCreateBookingTypeMutation();
  const [name, setName] = useState("");
  const [surcharge, setSurcharge] = useState("0.00");
  const [validationError, setValidationError] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const amount = parseMinorUnits(surcharge, locale);
    if (!name.trim() || amount === undefined) {
      setValidationError("Enter a name and a non-negative amount with up to two decimal places.");
      return;
    }
    setValidationError("");
    mutation.mutate(
      { name, surcharge_minor_units: amount, system_kind: "custom" },
      {
        onSuccess: () => {
          setName("");
          setSurcharge("0.00");
        },
      },
    );
  };
  return (
    <form className="booking-types-create" onSubmit={submit} noValidate>
      <h2>Add custom booking type</h2>
      <label htmlFor="booking-type-name">Name</label>
      <input
        id="booking-type-name"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setValidationError("");
        }}
        required
        maxLength={200}
      />
      <label htmlFor="booking-type-surcharge">Surcharge</label>
      <input
        id="booking-type-surcharge"
        inputMode="decimal"
        value={surcharge}
        onChange={(event) => {
          setSurcharge(event.target.value);
          setValidationError("");
        }}
        required
      />
      <button type="submit" disabled={mutation.isPending || !name.trim()}>
        {mutation.isPending ? "Creating…" : "Add booking type"}
      </button>
      {validationError ? <p role="alert">{validationError}</p> : null}
      {mutation.isError ? <p role="alert">{mutation.error.message}</p> : null}
    </form>
  );
}
