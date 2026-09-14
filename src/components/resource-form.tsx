import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Resource } from "@/api/resources";
import { useCreateResourceMutation, useUpdateResourceMutation } from "@/hooks/use-resources";
import { formatMoneyInput, parseMoney } from "@/lib/money";
import { mutationErrorMessage } from "@/lib/error-messages";
import "./resource-admin.css";

export function ResourceForm({
  resource,
  locale,
  currency,
}: {
  resource?: Resource;
  locale: string;
  currency: string;
}) {
  const form = useResourceFormState(resource, locale);
  const disabled = formDisabled(form.mutation.isPending, resource?.archived === true);
  const nameInvalid = hasFieldError(form.errorField, "name", form.error);
  const rateInvalid = hasFieldError(form.errorField, "rate", form.error);

  return (
    <section className="resource-form-surface" aria-labelledby="resource-form-title">
      <p className="eyebrow">Administration</p>
      <h1 id="resource-form-title">{resourceTitle(resource)}</h1>
      <form className="resource-form" onSubmit={form.submit} noValidate>
        <label htmlFor="resource-name">Resource name</label>
        <input
          ref={form.nameRef}
          id="resource-name"
          value={form.name}
          onChange={(event) => form.onNameChange(event.target.value)}
          disabled={disabled}
          aria-invalid={nameInvalid}
          aria-describedby={errorDescription(nameInvalid)}
        />
        <label htmlFor="resource-rate">Base rate ({currency})</label>
        <input
          id="resource-rate"
          inputMode="decimal"
          value={form.rate}
          onChange={(event) => form.onRateChange(event.target.value)}
          aria-invalid={rateInvalid}
          aria-describedby={rateDescription(rateInvalid)}
          disabled={disabled}
        />
        <p id="resource-rate-help">
          Use the locale format, for example {formatMoneyInput(123450, locale)}.
        </p>
        {renderResourceError(form.error)}
        <div className="resource-form-actions">
          <button
            type="button"
            onClick={() => form.navigate({ to: "/resources" })}
            disabled={form.mutation.isPending}
          >
            Cancel
          </button>
          <button type="submit" disabled={disabled}>
            {resourceActionLabel(resource, form.mutation.isPending)}
          </button>
        </div>
      </form>
    </section>
  );
}

function formDisabled(pending: boolean, archived: boolean) {
  return pending || archived;
}

function hasFieldError(errorField: "name" | "rate" | null, field: "name" | "rate", error: string) {
  return errorField === field || Boolean(error && !errorField);
}

function errorDescription(invalid: boolean) {
  return invalid ? "resource-form-error" : undefined;
}

function rateDescription(invalid: boolean) {
  return ["resource-rate-help", errorDescription(invalid)].filter(Boolean).join(" ");
}

function resourceTitle(resource: Resource | undefined) {
  return resource ? "Edit resource" : "New resource";
}

function resourceActionLabel(resource: Resource | undefined, pending: boolean) {
  if (pending) return "Saving…";
  return resource ? "Save changes" : "Create resource";
}

function renderResourceError(error: string) {
  return error ? (
    <p id="resource-form-error" className="resource-error" role="alert">
      {error}
    </p>
  ) : null;
}

type ResourceValidation =
  | { error: string; field: "name" | "rate" }
  | { trimmed: string; value: number };

function validateResourceForm(name: string, rate: string, locale: string): ResourceValidation {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Enter a resource name.", field: "name" };
  if (trimmed.length > 200) {
    return {
      error: "Resource names must be 200 characters or fewer.",
      field: "name",
    };
  }
  const parsed = parseMoney(rate, locale);
  return "error" in parsed
    ? { error: parsed.error, field: "rate" }
    : { trimmed, value: parsed.value };
}

function useResourceFormState(resource: Resource | undefined, locale: string) {
  const navigate = useNavigate();
  const [name, setName] = useState(resource?.name ?? "");
  const [rate, setRate] = useState(
    resource ? formatMoneyInput(resource.base_rate_minor_units, locale) : "",
  );
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<"name" | "rate" | null>(null);
  const rateLocaleRef = useRef(locale);
  const rateDirtyRef = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const create = useCreateResourceMutation();
  const update = useUpdateResourceMutation();
  const mutation = resource ? update : create;

  useEffect(() => nameRef.current?.focus(), []);
  useEffect(() => {
    if (!rateDirtyRef.current) {
      setRate(resource ? formatMoneyInput(resource.base_rate_minor_units, locale) : "");
      rateLocaleRef.current = locale;
    }
  }, [locale, resource]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateResourceForm(name, rate, rateLocaleRef.current);
    if ("error" in result) {
      setError(result.error);
      setErrorField(result.field);
      return;
    }
    setError("");
    setErrorField(null);
    const onSuccess = () => navigate({ to: "/resources" });
    const onError = (cause: Error) => {
      setError(mutationErrorMessage(cause, "resource-save"));
      setErrorField(null);
    };
    if (resource) {
      update.mutate(
        { id: resource.id, input: { name: result.trimmed, base_rate_minor_units: result.value } },
        { onSuccess, onError },
      );
    } else {
      create.mutate(
        { name: result.trimmed, base_rate_minor_units: result.value },
        { onSuccess, onError },
      );
    }
  }

  return {
    navigate,
    name,
    rate,
    error,
    errorField,
    mutation,
    nameRef,
    submit,
    onNameChange: (nextName: string) => {
      setName(nextName);
      setError("");
      setErrorField(null);
    },
    onRateChange: (nextRate: string) => {
      rateDirtyRef.current = true;
      rateLocaleRef.current = locale;
      setRate(nextRate);
      setError("");
      setErrorField(null);
    },
  };
}
