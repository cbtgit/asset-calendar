import { useState, type FormEvent } from "react";
import { useCreateBookingTypeMutation } from "@/hooks/use-booking-types";
import { formatMoneyInput, parseMoney } from "@/lib/money";
import { mutationErrorMessage } from "@/lib/error-messages";

export function CreateBookingTypeForm({ locale }: { locale: string }) {
  const mutation = useCreateBookingTypeMutation();
  const [name, setName] = useState("");
  const [surcharge, setSurcharge] = useState(() => formatMoneyInput(0, locale));
  const [validationError, setValidationError] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseMoney(surcharge, locale);
    if (!name.trim() || "error" in parsed) {
      setValidationError("Enter a name and a non-negative amount with up to two decimal places.");
      return;
    }
    setValidationError("");
    mutation.mutate(
      { name, surcharge_minor_units: parsed.value, system_kind: "custom" },
      {
        onSuccess: () => {
          setName("");
          setSurcharge(formatMoneyInput(0, locale));
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
      {mutation.isError ? (
        <p role="alert">{mutationErrorMessage(mutation.error, "booking-type-create")}</p>
      ) : null}
    </form>
  );
}
