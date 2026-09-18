import { useEffect, useRef, useState } from "react";
import { toAppError } from "@/api/errors";
import { activeUsersQueryOptions } from "@/api/users";
import { bookingTypesQueryOptions } from "@/api/booking-types";
import { useCreateBookingMutation, useUpdateBookingMutation } from "@/hooks/use-bookings";
import { useTenantSettingsQuery } from "@/hooks/use-tenant-settings";
import type { CalendarBooking } from "@/api/bookings";
import { applicationDateTimeToUtc, utcToApplicationDateTime } from "@/lib/time";
import { Button } from "@/components/base/Button";
import { CloseButton } from "@/components/base/CloseButton";
import { useQuery } from "@tanstack/react-query";
import "./booking-form.css";

type BookingFormProps = {
  resourceName: string;
  resourceId: string;
  isAdministrator: boolean;
  initialStart?: string;
  initialEnd?: string;
  initialDate?: string;
  initialBooking?: CalendarBooking;
  onCancel: () => void;
  onSuccess: () => void;
};

const BOOKING_TIME_STEP_SECONDS = 15 * 60;

function initialDateTime(value: string | undefined) {
  if (!value) return { date: "", time: "" };
  const local = utcToApplicationDateTime(value);
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}

function submittedDateTime(
  date: string,
  time: string,
  originalValue: string | undefined,
  originalDateTime: { date: string; time: string },
): string {
  if (originalValue && date === originalDateTime.date && time === originalDateTime.time) {
    return originalValue;
  }
  return applicationDateTimeToUtc(`${date}T${time}`);
}

function bookingErrorMessage(error: unknown, bookingLockHours: number): string {
  if (!error) return "";
  const applicationError = toAppError(error);
  const message = applicationError.message.toLowerCase();

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
  initialStart,
  initialEnd,
  initialDate,
  initialBooking,
  onCancel,
  onSuccess,
}: BookingFormProps) {
  const surfaceRef = useRef<HTMLElement>(null);
  const start = initialDateTime(initialStart);
  const end = initialDateTime(initialEnd);
  const [startDate, setStartDate] = useState(start.date || initialDate || "");
  const [startTime, setStartTime] = useState(start.time);
  const [endDate, setEndDate] = useState(end.date || start.date || initialDate || "");
  const [endTime, setEndTime] = useState(end.time);
  const [bookedForUser, setBookedForUser] = useState(initialBooking?.booked_for_user ?? "");
  const [bookingType, setBookingType] = useState(initialBooking?.booking_type ?? "");
  const [formError, setFormError] = useState("");
  const createMutation = useCreateBookingMutation();
  const updateMutation = useUpdateBookingMutation();
  const activeUsers = useQuery({ ...activeUsersQueryOptions(), enabled: isAdministrator });
  const bookingTypes = useQuery({ ...bookingTypesQueryOptions(), enabled: isAdministrator });
  const administratorQueryError = isAdministrator && (activeUsers.isError || bookingTypes.isError);
  const tenantSettings = useTenantSettingsQuery();

  useEffect(() => {
    surfaceRef.current?.focus();
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    if (!startDate || !startTime || !endDate || !endTime) {
      setFormError("Enter a start and end date and time.");
      return;
    }
    if (administratorQueryError) {
      setFormError("User and booking type data could not be loaded. Try again.");
      return;
    }

    const startValue = submittedDateTime(startDate, startTime, initialStart, start);
    const endValue = submittedDateTime(endDate, endTime, initialEnd, end);
    if (new Date(endValue) <= new Date(startValue)) {
      setFormError("The end must be after the start.");
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
              }
            : {}),
        });
      }
      onSuccess();
    } catch {
      // The mutation error is rendered below while preserving the entered form values.
    }
  }

  const mutation = initialBooking ? updateMutation : createMutation;
  const error =
    formError || bookingErrorMessage(mutation.error, tenantSettings.data?.booking_lock_hours ?? 24);

  return (
    <section
      ref={surfaceRef}
      className="booking-form-surface"
      aria-labelledby="booking-form-title"
      tabIndex={-1}
    >
      <header className="booking-form-heading">
        <div>
          <p className="eyebrow">{initialBooking ? "Edit booking" : "New booking"}</p>
          <h2 id="booking-form-title">{resourceName}</h2>
        </div>
        <CloseButton
          className="booking-form-close"
          size="compact"
          label="Close booking form"
          onClick={onCancel}
        />
      </header>

      <form className="booking-form" onSubmit={submit} noValidate>
        <div className="booking-form-grid">
          <label>
            <span>Start date</span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              required
            />
          </label>
          <label>
            <span>Start time</span>
            <input
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              step={BOOKING_TIME_STEP_SECONDS}
              required
            />
          </label>
          <label>
            <span>End date</span>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              required
            />
          </label>
          <label>
            <span>End time</span>
            <input
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              step={BOOKING_TIME_STEP_SECONDS}
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
                <option value="">No booking type</option>
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
            disabled={mutation.isPending || Boolean(administratorQueryError)}
          >
            {mutation.isPending ? "Saving..." : initialBooking ? "Save changes" : "Create booking"}
          </Button>
        </div>
      </form>
    </section>
  );
}
