import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Resource } from "@/api/resources";
import { useCreateResourceMutation, useUpdateResourceMutation } from "@/hooks/use-resources";
import { formatMoneyInput, parseMoney } from "@/lib/money";
import { mutationErrorMessage } from "@/lib/error-messages";
import "./resource-admin.css";

// oxlint-disable-next-line complexity, max-lines-per-function
export function ResourceForm({
  resource,
  locale,
  currency,
}: {
  resource?: Resource;
  locale: string;
  currency: string;
}) {
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
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a resource name.");
      setErrorField("name");
      return;
    }
    if (trimmed.length > 200) {
      setError("Resource names must be 200 characters or fewer.");
      setErrorField("name");
      return;
    }
    const parsed = parseMoney(rate, rateLocaleRef.current);
    if ("error" in parsed) {
      setError(parsed.error);
      setErrorField("rate");
      return;
    }
    setError("");
    setErrorField(null);
    if (resource) {
      update.mutate(
        { id: resource.id, input: { name: trimmed, base_rate_minor_units: parsed.value } },
        {
          onSuccess: () => navigate({ to: "/resources" }),
          onError: (cause) => {
            setError(mutationErrorMessage(cause, "resource-save"));
            setErrorField(null);
          },
        },
      );
    } else {
      create.mutate(
        { name: trimmed, base_rate_minor_units: parsed.value },
        {
          onSuccess: () => navigate({ to: "/resources" }),
          onError: (cause) => {
            setError(mutationErrorMessage(cause, "resource-save"));
            setErrorField(null);
          },
        },
      );
    }
  }

  return (
    <section className="resource-form-surface" aria-labelledby="resource-form-title">
      <p className="eyebrow">Administration</p>
      <h1 id="resource-form-title">{resource ? "Edit resource" : "New resource"}</h1>
      <form className="resource-form" onSubmit={submit} noValidate>
        <label htmlFor="resource-name">Resource name</label>
        <input
          ref={nameRef}
          id="resource-name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError("");
            setErrorField(null);
          }}
          disabled={mutation.isPending || Boolean(resource?.archived)}
          aria-invalid={errorField === "name" || Boolean(error && !errorField)}
          aria-describedby={
            errorField === "name" || (error && !errorField) ? "resource-form-error" : undefined
          }
        />
        <label htmlFor="resource-rate">Base rate ({currency})</label>
        <input
          id="resource-rate"
          inputMode="decimal"
          value={rate}
          onChange={(event) => {
            rateDirtyRef.current = true;
            rateLocaleRef.current = locale;
            setRate(event.target.value);
            setError("");
            setErrorField(null);
          }}
          aria-invalid={errorField === "rate" || Boolean(error && !errorField)}
          aria-describedby={[
            "resource-rate-help",
            errorField === "rate" || (error && !errorField) ? "resource-form-error" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          disabled={mutation.isPending || Boolean(resource?.archived)}
        />
        <p id="resource-rate-help">
          Use the locale format, for example {formatMoneyInput(123450, locale)}.
        </p>
        {error ? (
          <p id="resource-form-error" className="resource-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="resource-form-actions">
          <button
            type="button"
            onClick={() => navigate({ to: "/resources" })}
            disabled={mutation.isPending}
          >
            Cancel
          </button>
          <button type="submit" disabled={mutation.isPending || Boolean(resource?.archived)}>
            {mutation.isPending ? "Saving…" : resource ? "Save changes" : "Create resource"}
          </button>
        </div>
      </form>
    </section>
  );
}
