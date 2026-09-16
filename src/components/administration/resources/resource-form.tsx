import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Resource } from "@/api/resources";
import { ApplicationError, hasValidationCode } from "@/api/errors";
import { Button } from "@/components/base/Button";
import { NumberField } from "@/components/base/NumberField";
import { toMinorUnits } from "@/components/base/NumberField.utils";
import { DEFAULT_MONEY_LOCALE, formatMinorUnitsForInput } from "@/lib/money";
import { useCreateResourceMutation, useUpdateResourceMutation } from "@/hooks/use-resources";
import "./resource-form.css";

type ResourceFormProps = {
  mode?: "create" | "edit";
  initialResource?: Resource;
  onCancel: () => void;
  onSuccess?: () => void;
  locale?: string;
};

function initialHourlyPrice(resource: Resource | undefined, locale: string): string {
  return resource ? formatMinorUnitsForInput(resource.base_rate_minor_units, locale) : "";
}

export function ResourceForm({
  mode = "create",
  initialResource,
  onCancel,
  onSuccess,
  locale = DEFAULT_MONEY_LOCALE,
}: ResourceFormProps) {
  const [name, setName] = useState(initialResource?.name ?? "");
  const [hourlyPrice, setHourlyPrice] = useState(initialHourlyPrice(initialResource, locale));
  const [nameError, setNameError] = useState("");
  const [rateError, setRateError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const createMutation = useCreateResourceMutation();
  const updateMutation = useUpdateResourceMutation();
  const mutation = mode === "edit" ? updateMutation : createMutation;
  const conflictError =
    mutation.error instanceof ApplicationError &&
    (mutation.error.kind === "conflict" ||
      (mutation.error.kind === "validation" &&
        hasValidationCode(mutation.error, "validation_not_unique")))
      ? "A resource with this name already exists."
      : undefined;

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNameError("");
    setSubmitted(false);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError("Enter a resource name.");
      nameRef.current?.focus();
      return;
    }

    const hourlyPriceMinorUnits = toMinorUnits(hourlyPrice, locale);
    if (hourlyPriceMinorUnits === undefined) {
      setRateError(
        `Enter a valid hourly price, such as ${formatMinorUnitsForInput(123450, locale)}.`,
      );
      return;
    }
    setRateError("");
    const input = { name: trimmedName, baseRateMinorUnits: hourlyPriceMinorUnits };
    if (mode === "edit" && initialResource) {
      updateMutation.mutate({ id: initialResource.id, input }, { onSuccess: () => onSuccess?.() });
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
    <section className="resource-form-surface" aria-labelledby="resource-form-title">
      <p className="eyebrow">Administration</p>
      <h1 id="resource-form-title">{mode === "edit" ? "Edit Resource" : "New Resource"}</h1>
      <form className="resource-form" onSubmit={submit} noValidate>
        <label htmlFor="resource-name">Resource</label>
        <input
          ref={nameRef}
          id="resource-name"
          name="resource"
          value={name}
          maxLength={200}
          aria-invalid={Boolean(nameError || conflictError)}
          aria-describedby={nameError || conflictError ? "resource-name-error" : undefined}
          onChange={(event) => {
            setName(event.target.value);
            setNameError("");
          }}
        />
        {nameError || conflictError ? (
          <p id="resource-name-error" className="resource-form-error" role="alert">
            {nameError || conflictError}
          </p>
        ) : null}
        <NumberField
          id="resource-hourly-price"
          label="Hourly price"
          name="hourlyPrice"
          value={hourlyPrice}
          required
          error={rateError || undefined}
          onChange={(event) => {
            setHourlyPrice(event.target.value);
            setRateError("");
          }}
        />
        <div className="resource-form-actions">
          <Button type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
        {mutation.error && !conflictError ? (
          <p role="alert" className="resource-form-error">
            We could not save this resource. Try again.
          </p>
        ) : null}
        <p className="resource-form-announcement" aria-live="polite">
          {submitted ? "Resource details are ready to save." : ""}
        </p>
      </form>
    </section>
  );
}
