import { useEffect, useRef, useState, type FormEvent } from "react";
import type { TenantSettings } from "@/api/tenant-settings";
import { Button } from "@/components/base/Button";
import { useUpdateTenantSettingsMutation } from "@/hooks/use-tenant-settings";
import "./tenant-settings-form.css";

type TenantSettingsFormProps = {
  settings: TenantSettings;
};

export function TenantSettingsForm({ settings }: TenantSettingsFormProps) {
  const [siteTitle, setSiteTitle] = useState(settings.site_title);
  const [bookingLockHours, setBookingLockHours] = useState(String(settings.booking_lock_hours));
  const [siteTitleError, setSiteTitleError] = useState("");
  const [bookingLockHoursError, setBookingLockHoursError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const siteTitleRef = useRef<HTMLInputElement>(null);
  const mutation = useUpdateTenantSettingsMutation();

  useEffect(() => {
    siteTitleRef.current?.focus();
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSiteTitleError("");
    setBookingLockHoursError("");
    setSubmitted(false);

    const trimmedSiteTitle = siteTitle.trim();
    if (!trimmedSiteTitle) {
      setSiteTitleError("Enter a site title.");
      siteTitleRef.current?.focus();
      return;
    }
    if (trimmedSiteTitle.length > 200) {
      setSiteTitleError("The site title must be 200 characters or fewer.");
      siteTitleRef.current?.focus();
      return;
    }

    if (!/^\d+$/.test(bookingLockHours)) {
      setBookingLockHoursError("Enter a whole number of hours, including 0.");
      return;
    }
    const lockHours = Number(bookingLockHours);
    if (!Number.isSafeInteger(lockHours) || lockHours < 0) {
      setBookingLockHoursError("Enter a whole number of hours, including 0.");
      return;
    }

    mutation.mutate(
      {
        id: settings.id,
        input: { siteTitle: trimmedSiteTitle, bookingLockHours: lockHours },
      },
      { onSuccess: () => setSubmitted(true) },
    );
  }

  return (
    <section className="tenant-settings-form-surface" aria-labelledby="tenant-settings-title">
      <p className="eyebrow">Administration</p>
      <h1 id="tenant-settings-title">Tenant Settings</h1>
      <p>Set the title shown in the authenticated header and the booking edit window.</p>
      <form className="tenant-settings-form" onSubmit={submit} noValidate>
        <label htmlFor="tenant-settings-site-title">Site title</label>
        <input
          ref={siteTitleRef}
          id="tenant-settings-site-title"
          name="siteTitle"
          value={siteTitle}
          maxLength={200}
          aria-invalid={Boolean(siteTitleError)}
          aria-describedby={siteTitleError ? "tenant-settings-site-title-error" : undefined}
          onChange={(event) => {
            setSiteTitle(event.target.value);
            setSiteTitleError("");
          }}
        />
        {siteTitleError ? (
          <p
            id="tenant-settings-site-title-error"
            className="tenant-settings-form-error"
            role="alert"
          >
            {siteTitleError}
          </p>
        ) : null}
        <label htmlFor="tenant-settings-booking-lock-hours">Booking lock hours</label>
        <input
          id="tenant-settings-booking-lock-hours"
          name="bookingLockHours"
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          value={bookingLockHours}
          aria-invalid={Boolean(bookingLockHoursError)}
          aria-describedby={
            bookingLockHoursError ? "tenant-settings-booking-lock-hours-error" : undefined
          }
          onChange={(event) => {
            setBookingLockHours(event.target.value);
            setBookingLockHoursError("");
          }}
        />
        {bookingLockHoursError ? (
          <p
            id="tenant-settings-booking-lock-hours-error"
            className="tenant-settings-form-error"
            role="alert"
          >
            {bookingLockHoursError}
          </p>
        ) : null}
        <div className="tenant-settings-form-actions">
          <Button type="submit" variant="primary" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
        {mutation.error ? (
          <p role="alert" className="tenant-settings-form-error">
            We could not save the tenant settings. Try again.
          </p>
        ) : null}
        <p className="tenant-settings-form-announcement" aria-live="polite">
          {submitted ? "Tenant settings saved." : ""}
        </p>
      </form>
    </section>
  );
}
