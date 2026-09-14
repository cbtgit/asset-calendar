import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  useTenantSettingsQuery,
  useUpdateTenantSettingsMutation,
} from "@/hooks/use-tenant-settings";

export function TenantSettingsForm() {
  const settings = useTenantSettingsQuery();
  const update = useUpdateTenantSettingsMutation();
  const [locale, setLocale] = useState("");
  const [error, setError] = useState("");
  const localeRef = useRef<HTMLInputElement>(null);
  const dirtyRef = useRef(false);
  const initialFocusRef = useRef(false);

  useEffect(() => {
    if (settings.data && !dirtyRef.current) setLocale(settings.data.locale);
    if (settings.data && !initialFocusRef.current) {
      initialFocusRef.current = true;
      localeRef.current?.focus();
    }
  }, [settings.data]);

  if (settings.isPending) return <p role="status">Loading tenant settings…</p>;
  if (settings.isError)
    return (
      <p className="resource-error" role="alert">
        We could not load settings: {settings.error.message}
      </p>
    );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const normalized = new Intl.Locale(locale.trim()).toString();
      if (!normalized) throw new Error();
      setError("");
      update.mutate(
        { locale: normalized },
        {
          onSuccess: (saved) => {
            setLocale(saved.locale);
            dirtyRef.current = false;
          },
          onError: (cause) => setError(cause.message),
        },
      );
    } catch {
      setError("Enter a valid BCP 47 locale, such as en-US or da-DK.");
    }
  }

  return (
    <section className="resource-form-surface" aria-labelledby="tenant-settings-title">
      <p className="eyebrow">Administration</p>
      <h1 id="tenant-settings-title">Tenant settings</h1>
      <form className="resource-form" onSubmit={submit} noValidate>
        <label htmlFor="tenant-locale">Locale</label>
        <input
          ref={localeRef}
          id="tenant-locale"
          value={locale}
          onChange={(event) => {
            dirtyRef.current = true;
            setLocale(event.target.value);
            setError("");
          }}
          disabled={update.isPending}
        />
        <label htmlFor="tenant-currency">Currency</label>
        <input id="tenant-currency" value={settings.data.currency} readOnly aria-readonly="true" />
        <p>Currency is set when the tenant is provisioned and cannot be changed.</p>
        {error ? (
          <p className="resource-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save settings"}
        </button>
      </form>
    </section>
  );
}
