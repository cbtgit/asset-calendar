import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  TENANT_CURRENCIES,
  TENANT_TIME_ZONES,
  type TenantSettings,
  type TenantSettingsUpdate,
} from "@/api/tenant-settings";
import { Button } from "@/components/base/Button";
import { useUpdateTenantSettingsMutation } from "@/hooks/use-tenant-settings";
import { ApplicationError } from "@/api/errors";
import "./tenant-settings-form.css";

type TenantSettingsFormProps = {
  settings: TenantSettings;
};

function isLocale(value: string): boolean {
  return /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(value);
}

export function TenantSettingsForm({ settings }: TenantSettingsFormProps) {
  const [locale, setLocale] = useState(settings.locale);
  const [currency, setCurrency] = useState(settings.currency_code);
  const [timezone, setTimezone] = useState(settings.timezone);
  const [leadHours, setLeadHours] = useState(String(settings.booking_edit_lead_hours));
  const [headingTitle, setHeadingTitle] = useState(settings.heading_title);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const localeRef = useRef<HTMLInputElement>(null);
  const mutation = useUpdateTenantSettingsMutation();

  useEffect(() => {
    localeRef.current?.focus();
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaved(false);
    const normalizedLocale = locale.trim();
    const normalizedHeading = headingTitle.trim();
    const parsedLeadHours = Number(leadHours);

    if (!isLocale(normalizedLocale)) {
      setError("Enter a valid locale, such as da-DK or en-GB.");
      localeRef.current?.focus();
      return;
    }
    if (!Number.isSafeInteger(parsedLeadHours) || parsedLeadHours < 0) {
      setError("Enter a whole number of hours that is zero or greater.");
      return;
    }
    if (!normalizedHeading || normalizedHeading.length > 200) {
      setError("Enter a heading title between 1 and 200 characters.");
      return;
    }

    const input: TenantSettingsUpdate = {
      locale: normalizedLocale,
      currency_code: currency,
      timezone,
      booking_edit_lead_hours: parsedLeadHours,
      heading_title: normalizedHeading,
    };
    mutation.mutate({ id: settings.id, input }, { onSuccess: () => setSaved(true) });
  }

  const serverError = mutation.error instanceof ApplicationError;

  return (
    <section className="tenant-settings" aria-labelledby="tenant-settings-title">
      <p className="eyebrow">Administration</p>
      <h1 id="tenant-settings-title">Tenant settings</h1>
      <p className="tenant-settings-intro">
        Set the language, currency, time zone, and booking rules for this tenant.
      </p>
      <form className="tenant-settings-form" onSubmit={submit} noValidate>
        <label>
          <span>Heading title</span>
          <input
            value={headingTitle}
            maxLength={200}
            onChange={(event) => setHeadingTitle(event.target.value)}
            required
          />
        </label>
        <label>
          <span>Locale</span>
          <input
            ref={localeRef}
            value={locale}
            maxLength={35}
            onChange={(event) => setLocale(event.target.value)}
            required
          />
        </label>
        <label>
          <span>Currency</span>
          <select
            value={currency}
            onChange={(event) => setCurrency(event.target.value as typeof currency)}
          >
            {TENANT_CURRENCIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Time zone</span>
          <select
            value={timezone}
            onChange={(event) => setTimezone(event.target.value as typeof timezone)}
          >
            {TENANT_TIME_ZONES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Booking edit lead time (hours)</span>
          <input
            type="number"
            min={0}
            step={1}
            value={leadHours}
            onChange={(event) => setLeadHours(event.target.value)}
            required
          />
        </label>
        {error || serverError ? (
          <p className="tenant-settings-error" role="alert">
            {error || "We could not save the tenant settings. Try again."}
          </p>
        ) : null}
        <div className="tenant-settings-actions">
          <Button type="submit" variant="primary" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save settings"}
          </Button>
          <span aria-live="polite">{saved ? "Settings saved." : ""}</span>
        </div>
      </form>
    </section>
  );
}
