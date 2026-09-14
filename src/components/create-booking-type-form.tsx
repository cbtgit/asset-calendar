import { useEffect, useRef, useState, type FormEvent } from "react";
import { useCreateBookingTypeMutation } from "@/hooks/use-booking-types";
import { formatMoneyInput, parseMoney } from "@/lib/money";
import { mutationErrorMessage } from "@/lib/error-messages";

// oxlint-disable-next-line complexity
export function CreateBookingTypeForm({ locale }: { locale: string }) {
  const mutation = useCreateBookingTypeMutation();
  const [name, setName] = useState("");
  const [surcharge, setSurcharge] = useState(() => formatMoneyInput(0, locale));
  const [validationError, setValidationError] = useState("");
  const [validationField, setValidationField] = useState<"name" | "surcharge" | null>(null);
  const surchargeLocaleRef = useRef(locale);
  const surchargeDirtyRef = useRef(false);
  const nameErrorId = "booking-type-create-name-error";
  const surchargeErrorId = "booking-type-create-surcharge-error";
  const mutationErrorId = "booking-type-create-mutation-error";
  const mutationError = mutation.isError
    ? mutationErrorMessage(mutation.error, "booking-type-create")
    : "";
  useEffect(() => {
    if (!surchargeDirtyRef.current) {
      setSurcharge(formatMoneyInput(0, locale));
      surchargeLocaleRef.current = locale;
    }
  }, [locale]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseMoney(surcharge, surchargeLocaleRef.current);
    if (!name.trim() || "error" in parsed) {
      setValidationError("Enter a name and a non-negative amount with up to two decimal places.");
      setValidationField(!name.trim() ? "name" : "surcharge");
      return;
    }
    setValidationError("");
    setValidationField(null);
    mutation.mutate(
      { name, surcharge_minor_units: parsed.value, system_kind: "custom" },
      {
        onSuccess: () => {
          setName("");
          setSurcharge(formatMoneyInput(0, locale));
          surchargeDirtyRef.current = false;
          surchargeLocaleRef.current = locale;
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
          setValidationField(null);
        }}
        required
        maxLength={200}
        aria-invalid={validationField === "name" || Boolean(mutationError)}
        aria-describedby={
          [validationField === "name" ? nameErrorId : "", mutationError ? mutationErrorId : ""]
            .filter(Boolean)
            .join(" ") || undefined
        }
      />
      <label htmlFor="booking-type-surcharge">Surcharge</label>
      <input
        id="booking-type-surcharge"
        inputMode="decimal"
        value={surcharge}
        onChange={(event) => {
          surchargeDirtyRef.current = true;
          surchargeLocaleRef.current = locale;
          setSurcharge(event.target.value);
          setValidationError("");
          setValidationField(null);
        }}
        required
        aria-invalid={validationField === "surcharge" || Boolean(mutationError)}
        aria-describedby={
          [
            validationField === "surcharge" ? surchargeErrorId : "",
            mutationError ? mutationErrorId : "",
          ]
            .filter(Boolean)
            .join(" ") || undefined
        }
      />
      <button type="submit" disabled={mutation.isPending || !name.trim()}>
        {mutation.isPending ? "Creating…" : "Add booking type"}
      </button>
      {validationError ? (
        <p id={validationField === "name" ? nameErrorId : surchargeErrorId} role="alert">
          {validationError}
        </p>
      ) : null}
      {mutationError ? (
        <p id={mutationErrorId} role="alert">
          {mutationError}
        </p>
      ) : null}
    </form>
  );
}
