import { useEffect, useRef, useState } from "react";
import { toAppError } from "@/api/errors";
import { activeUsersQueryOptions } from "@/api/users";
import { bookingTypesQueryOptions, DEFAULT_BOOKING_TYPE_COLOR } from "@/api/booking-types";
import { useCreateBookingMutation, useUpdateBookingMutation } from "@/hooks/use-bookings";
import { useTenantSettingsQuery } from "@/hooks/use-tenant-settings";
import { useAuth } from "@/hooks/use-auth";
import type { CalendarBooking } from "@/api/bookings";
import {
  APPLICATION_TIME_ZONE,
  applicationDateTimeToUtc,
  bookingEditLockStatus,
  utcToApplicationDateTime,
  weeklyBookingReleaseAt,
} from "@/lib/time";
import { Button } from "@/components/base/Button";
import { CloseButton } from "@/components/base/CloseButton";
import { useQuery } from "@tanstack/react-query";
import "./booking-form.css";

type BookingFormProps = {
  resourceName: string;
  resourceId: string;
  isAdministrator: boolean;
  bookingReleasePolicy?: {
    priority_booking_enabled: boolean;
    public_booking_release_weekday: number;
    public_booking_release_time: string;
  };
  initialStart?: string;
  initialEnd?: string;
  initialDate?: string;
  initialBooking?: CalendarBooking;
  onCancel: () => void;
  onSuccess: () => void;
};

type BookingDateTimeValues = {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
};

const BOOKING_TIME_STEP_SECONDS = 15 * 60;

function initialDateTime(value: string | undefined, timeZone: string) {
  if (!value) return { date: "", time: "" };
  const local = utcToApplicationDateTime(value, timeZone);
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}

function submittedDateTime(
  date: string,
  time: string,
  originalValue: string | undefined,
  originalDateTime: { date: string; time: string },
  timeZone: string,
): string {
  if (originalValue && date === originalDateTime.date && time === originalDateTime.time) {
    return originalValue;
  }
  return applicationDateTimeToUtc(`${date}T${time}`, timeZone);
}

function safeSubmittedDateTime(
  date: string,
  time: string,
  originalValue: string | undefined,
  originalDateTime: { date: string; time: string },
  timeZone: string,
): string | undefined {
  try {
    return submittedDateTime(date, time, originalValue, originalDateTime, timeZone);
  } catch {
    return undefined;
  }
}

function errorMessages(error: unknown): string {
  const applicationError = toAppError(error);
  const messages = [applicationError.message];
  const cause = applicationError.cause;
  if (cause instanceof Error) messages.push(cause.message);
  if (typeof cause === "object" && cause !== null) {
    const response = Reflect.get(cause, "response");
    if (typeof response === "object" && response !== null) {
      const responseMessage = Reflect.get(response, "message");
      if (typeof responseMessage === "string") messages.push(responseMessage);
      const data = Reflect.get(response, "data");
      if (typeof data === "object" && data !== null) {
        const dataMessage = Reflect.get(data, "message");
        if (typeof dataMessage === "string") messages.push(dataMessage);
      }
    }
  }
  return messages.join(" ").toLowerCase();
}

function releaseMessage(releaseAt: Date, timeZone: string, isEdit = false): string {
  const date = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone,
  }).format(releaseAt);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(releaseAt);
  return isEdit
    ? `This booking cannot be moved into that week until everyone can book on ${date} at ${time} (${timeZone}).`
    : `This week opens to everyone ${date} at ${time} (${timeZone}).`;
}

function bookingErrorMessage(
  error: unknown,
  bookingLockHours: number,
  timeZone: string,
  fallbackReleaseAt?: Date,
): string {
  if (!error) return "";
  const applicationError = toAppError(error);
  const message = errorMessages(error);

  if (message.includes("booking_week_not_open")) {
    const releaseValue = message.match(
      /booking_week_not_open:(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?z)/i,
    )?.[1];
    const serverRelease = releaseValue
      ? new Date(Date.parse(releaseValue.replace(" ", "T")))
      : undefined;
    return releaseMessage(
      serverRelease && Number.isFinite(serverRelease.getTime())
        ? serverRelease
        : (fallbackReleaseAt ?? new Date()),
      timeZone,
    );
  }

  if (message.includes("booking_resource_conflict")) {
    return "This resource is already booked during that time. Choose a different time.";
  }
  if (message.includes("booking_resource_archived")) {
    return "This resource is archived and cannot accept new bookings.";
  }
  if (message.includes("booking_time_alignment_invalid")) {
    return "Choose times in 15-minute increments, such as 09:00 or 09:15.";
  }
  if (message.includes("booking_duration_invalid")) {
    return "The end time must be after the start time.";
  }
  if (message.includes("booking_edit_window_closed")) {
    return "This booking can no longer be edited because its current start is too soon.";
  }
  if (message.includes("booking_edit_start_too_soon")) {
    const hours = `${bookingLockHours} hour${bookingLockHours === 1 ? "" : "s"}`;
    return `Regular bookings must be moved to a start at least ${hours} from now.`;
  }
  if (message.includes("booking_booked_for_user_inactive")) {
    return "Select an active user for this booking.";
  }
  if (message.includes("booking_type_archived")) {
    return "Archived booking types cannot be selected.";
  }
  if (message.includes("booking_start_invalid") || message.includes("booking_end_invalid")) {
    return "Enter valid start and end dates and times.";
  }
  if (applicationError.kind === "unauthorized") {
    return "You are not allowed to save this booking.";
  }
  if (applicationError.kind === "network" || applicationError.kind === "server") {
    return "We could not save the booking. Try again.";
  }
  return "We could not save the booking. Check the details and try again.";
}

export function BookingForm({
  resourceName,
  resourceId,
  isAdministrator,
  bookingReleasePolicy,
  initialStart,
  initialEnd,
  initialDate,
  initialBooking,
  onCancel,
  onSuccess,
}: BookingFormProps) {
  const surfaceRef = useRef<HTMLElement>(null);
  const tenantSettings = useTenantSettingsQuery();
  const timeZone = tenantSettings.data?.time_zone ?? APPLICATION_TIME_ZONE;
  const auth = useAuth();
  const bookingAccess = auth.user?.booking_access;
  const hasPriorityBookingAccess = Array.isArray(bookingAccess)
    ? bookingAccess.includes("priority")
    : bookingAccess === "priority";
  const [dateTimeDraft, setDateTimeDraft] = useState<BookingDateTimeValues>();
  const [dateTimeEditTimeZone, setDateTimeEditTimeZone] = useState<string>();
  const inputTimeZone = dateTimeEditTimeZone ?? timeZone;
  const start = initialDateTime(initialStart, inputTimeZone);
  const end = initialDateTime(initialEnd, inputTimeZone);
  const dateTimeValues = dateTimeDraft ?? {
    startDate: start.date || initialDate || "",
    startTime: start.time,
    endDate: end.date || start.date || initialDate || "",
    endTime: end.time,
  };
  const { startDate, startTime, endDate, endTime } = dateTimeValues;
  const [bookedForUser, setBookedForUser] = useState(initialBooking?.booked_for_user ?? "");
  const [bookingType, setBookingType] = useState(initialBooking?.booking_type ?? "");
  const [formError, setFormError] = useState("");
  const createMutation = useCreateBookingMutation();
  const updateMutation = useUpdateBookingMutation();
  const mutation = initialBooking ? updateMutation : createMutation;
  const activeUsers = useQuery({ ...activeUsersQueryOptions(), enabled: isAdministrator });
  const bookingTypes = useQuery({ ...bookingTypesQueryOptions(), enabled: isAdministrator });
  const administratorQueryError = isAdministrator && (activeUsers.isError || bookingTypes.isError);
  const [releasedTimestamp, setReleasedTimestamp] = useState<number>();
  const [clockTimestamp, setClockTimestamp] = useState(() => Date.now());
  const bookingLockHours = tenantSettings.data?.booking_lock_hours ?? 24;
  const proposedStartValue =
    startDate && startTime
      ? safeSubmittedDateTime(startDate, startTime, initialStart, start, inputTimeZone)
      : undefined;
  const proposedEndValue =
    endDate && endTime
      ? safeSubmittedDateTime(endDate, endTime, initialEnd, end, inputTimeZone)
      : undefined;
  const intervalChanged = Boolean(
    initialBooking && (proposedStartValue !== initialStart || proposedEndValue !== initialEnd),
  );
  const editLockStatus = bookingEditLockStatus(
    initialBooking ? initialStart : undefined,
    proposedStartValue,
    bookingLockHours,
    isAdministrator,
    new Date(clockTimestamp),
  );
  const currentStartLocked = Boolean(initialBooking && editLockStatus.currentStartLocked);
  const proposedStartLocked = Boolean(
    initialBooking && intervalChanged && editLockStatus.proposedStartLocked,
  );
  const bookingLockDuration = `${bookingLockHours} hour${bookingLockHours === 1 ? "" : "s"}`;
  const releaseAt =
    (!initialBooking || intervalChanged) &&
    bookingReleasePolicy?.priority_booking_enabled &&
    !isAdministrator &&
    !hasPriorityBookingAccess
      ? weeklyBookingReleaseAt(
          startDate,
          endDate,
          endTime,
          bookingReleasePolicy.public_booking_release_weekday,
          bookingReleasePolicy.public_booking_release_time,
          timeZone,
        )
      : undefined;
  const releaseTimestamp = releaseAt?.getTime();
  const releasePending = Boolean(
    releaseTimestamp && clockTimestamp < releaseTimestamp && releasedTimestamp !== releaseTimestamp,
  );
  const releaseStatus =
    releasePending && releaseAt ? releaseMessage(releaseAt, timeZone, Boolean(initialBooking)) : "";
  const editLockMessage = currentStartLocked
    ? `This booking is read-only because its current start is within the ${bookingLockDuration} edit window.`
    : proposedStartLocked
      ? `The new start must be at least ${bookingLockDuration} from now.`
      : "";
  const lockMilliseconds = bookingLockHours * 60 * 60 * 1000;
  const nextLockBoundary =
    initialBooking && !isAdministrator && lockMilliseconds > 0
      ? [initialStart, proposedStartValue]
          .filter((value): value is string => Boolean(value))
          .map((value) => Date.parse(value) - lockMilliseconds)
          .filter((value) => Number.isFinite(value) && value > clockTimestamp)
          .sort((left, right) => left - right)[0]
      : undefined;

  useEffect(() => {
    if (releaseTimestamp === undefined) return;
    let timer = 0;
    const checkRelease = () => {
      const remaining = releaseTimestamp - Date.now();
      if (remaining <= 0) {
        setClockTimestamp(Date.now());
        setReleasedTimestamp(releaseTimestamp);
        return;
      }
      timer = window.setTimeout(checkRelease, Math.min(remaining + 1, 2_147_483_647));
    };
    timer = window.setTimeout(checkRelease, 0);
    return () => window.clearTimeout(timer);
  }, [releaseTimestamp]);

  useEffect(() => {
    if (nextLockBoundary === undefined) return;
    const delay = Math.min(Math.max(0, nextLockBoundary - clockTimestamp + 1), 2_147_483_647);
    const timer = window.setTimeout(() => setClockTimestamp(Date.now()), delay);
    return () => window.clearTimeout(timer);
  }, [clockTimestamp, nextLockBoundary]);

  useEffect(() => {
    surfaceRef.current?.focus();
  }, []);

  function updateDateTime(field: keyof BookingDateTimeValues, value: string) {
    setClockTimestamp(Date.now());
    setDateTimeEditTimeZone((current) => current ?? timeZone);
    setDateTimeDraft((current) => ({ ...(current ?? dateTimeValues), [field]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.reset();
    setFormError("");
    if (!startDate || !startTime || !endDate || !endTime) {
      setFormError("Enter a start and end date and time.");
      return;
    }
    if (administratorQueryError) {
      setFormError("User and booking type data could not be loaded. Try again.");
      return;
    }

    const startValue = submittedDateTime(startDate, startTime, initialStart, start, inputTimeZone);
    const endValue = submittedDateTime(endDate, endTime, initialEnd, end, inputTimeZone);
    if (new Date(endValue) <= new Date(startValue)) {
      setFormError("The end must be after the start.");
      return;
    }
    const timeChanged = Boolean(
      initialBooking && (startValue !== initialStart || endValue !== initialEnd),
    );
    const submitLockStatus = bookingEditLockStatus(
      initialBooking ? initialStart : undefined,
      startValue,
      bookingLockHours,
      isAdministrator,
      new Date(),
    );
    if (initialBooking && submitLockStatus.currentStartLocked) {
      setFormError(
        `This booking cannot be changed because its current start is within the ${bookingLockDuration} edit window.`,
      );
      return;
    }
    if (timeChanged && submitLockStatus.proposedStartLocked) {
      setFormError(`The new start must be at least ${bookingLockDuration} from now.`);
      return;
    }
    if (releaseAt && clockTimestamp < releaseAt.getTime()) {
      setFormError(releaseMessage(releaseAt, timeZone, Boolean(initialBooking)));
      return;
    }
    if (isAdministrator && !bookedForUser) {
      setFormError("Select the user this booking is for.");
      return;
    }

    try {
      if (initialBooking) {
        const selectedUser = activeUsers.data?.find((user) => user.id === bookedForUser);
        const selectedType = bookingTypes.data?.find((type) => type.id === bookingType);
        await updateMutation.mutateAsync({
          id: initialBooking.id,
          start: startValue,
          end: endValue,
          ...(isAdministrator
            ? { booked_for_user: bookedForUser, booking_type: bookingType || null }
            : {}),
          optimisticBooking: {
            ...initialBooking,
            ...(isAdministrator
              ? {
                  booker_display_name:
                    selectedUser?.display_name ||
                    selectedUser?.email ||
                    initialBooking.booker_display_name,
                  booking_type_name: selectedType?.name ?? null,
                  booking_type_color: selectedType?.color ?? DEFAULT_BOOKING_TYPE_COLOR,
                }
              : {}),
          },
        });
      } else {
        const selectedUser = activeUsers.data?.find((user) => user.id === bookedForUser);
        const selectedType = bookingTypes.data?.find((type) => type.id === bookingType);
        await createMutation.mutateAsync({
          resource: resourceId,
          start: startValue,
          end: endValue,
          ...(isAdministrator
            ? { booked_for_user: bookedForUser, booking_type: bookingType || null }
            : {}),
          ...(isAdministrator
            ? {
                optimisticBookerDisplayName: selectedUser?.display_name || selectedUser?.email,
                optimisticBookingTypeName: selectedType?.name ?? null,
                optimisticBookingTypeColor: selectedType?.color ?? DEFAULT_BOOKING_TYPE_COLOR,
              }
            : {}),
        });
      }
      onSuccess();
    } catch {
      // The mutation error is rendered below while preserving the entered form values.
    }
  }

  const error =
    formError ||
    bookingErrorMessage(
      mutation.error,
      tenantSettings.data?.booking_lock_hours ?? 24,
      timeZone,
      releaseAt,
    );

  return (
    <section
      ref={surfaceRef}
      className="booking-form-surface"
      aria-labelledby="booking-form-title"
      tabIndex={-1}
    >
      <header className="booking-form-heading">
        <div className="booking-form-heading-title">
          <p className="eyebrow">{initialBooking ? "Edit booking" : "New booking"}</p>
          <h2 id="booking-form-title">{resourceName}</h2>
        </div>
        <CloseButton
          className="booking-form-close"
          size="compact"
          label="Close booking form"
          onClick={onCancel}
        />
        {releaseStatus ? (
          <p className="booking-form-release-status" role="status">
            {releaseStatus}
          </p>
        ) : null}
        {editLockMessage ? (
          <p className="booking-form-lock-status" role="alert">
            {editLockMessage}
          </p>
        ) : null}
      </header>

      <form className="booking-form" onSubmit={submit} noValidate>
        <div className="booking-form-grid">
          <label>
            <span>Start date</span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => updateDateTime("startDate", event.target.value)}
              disabled={currentStartLocked}
              required
            />
          </label>
          <label>
            <span>Start time</span>
            <input
              type="time"
              value={startTime}
              onChange={(event) => updateDateTime("startTime", event.target.value)}
              step={BOOKING_TIME_STEP_SECONDS}
              disabled={currentStartLocked}
              required
            />
          </label>
          <label>
            <span>End date</span>
            <input
              type="date"
              value={endDate}
              onChange={(event) => updateDateTime("endDate", event.target.value)}
              disabled={currentStartLocked}
              required
            />
          </label>
          <label>
            <span>End time</span>
            <input
              type="time"
              value={endTime}
              onChange={(event) => updateDateTime("endTime", event.target.value)}
              step={BOOKING_TIME_STEP_SECONDS}
              disabled={currentStartLocked}
              required
            />
          </label>
        </div>

        {isAdministrator ? (
          <div className="booking-form-grid">
            <label>
              <span>User</span>
              <select
                value={bookedForUser}
                onChange={(event) => setBookedForUser(event.target.value)}
                disabled={activeUsers.isPending || activeUsers.isError}
                required
              >
                <option value="">Select a user</option>
                {[
                  ...(initialBooking?.booked_for_user &&
                  !activeUsers.data?.some((user) => user.id === initialBooking.booked_for_user)
                    ? [
                        {
                          id: initialBooking.booked_for_user,
                          display_name: initialBooking.booker_display_name,
                          email: initialBooking.booker_display_name,
                        },
                      ]
                    : []),
                  ...(activeUsers.data ?? []),
                ].map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.display_name || user.email}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Booking type</span>
              <select
                value={bookingType}
                onChange={(event) => setBookingType(event.target.value)}
                disabled={bookingTypes.isPending || bookingTypes.isError}
              >
                <option value="">Microscope</option>
                {[
                  ...(initialBooking?.booking_type &&
                  !bookingTypes.data?.some((type) => type.id === initialBooking.booking_type)
                    ? [
                        {
                          id: initialBooking.booking_type,
                          name: initialBooking.booking_type_name ?? "Current booking type",
                          archived_at: "",
                        },
                      ]
                    : []),
                  ...(bookingTypes.data?.filter((type) => !type.archived_at) ?? []),
                ].map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        {administratorQueryError ? (
          <p className="booking-form-error" role="alert">
            Unable to load administrator booking options. Try again before saving.
          </p>
        ) : null}

        {error ? (
          <p className="booking-form-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="booking-form-actions">
          <Button type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={
              mutation.isPending ||
              Boolean(administratorQueryError) ||
              releasePending ||
              currentStartLocked ||
              proposedStartLocked
            }
          >
            {mutation.isPending ? "Saving..." : initialBooking ? "Save changes" : "Save"}
          </Button>
        </div>
      </form>
    </section>
  );
}
