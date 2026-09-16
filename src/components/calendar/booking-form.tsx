import { useState } from "react";
import { toAppError } from "@/api/errors";
import { activeUsersQueryOptions } from "@/api/users";
import { bookingTypesQueryOptions } from "@/api/booking-types";
import { useCreateBookingMutation } from "@/hooks/use-bookings";
import { applicationDateTimeToUtc, utcToApplicationDateTime } from "@/lib/time";
import { Button } from "@/components/base/Button";
import { useQuery } from "@tanstack/react-query";
import "./booking-form.css";

type BookingFormProps = {
  resourceName: string;
  resourceId: string;
  isAdministrator: boolean;
  initialStart?: string;
  initialEnd?: string;
  initialDate?: string;
  onCancel: () => void;
  onSuccess: () => void;
};

function initialDateTime(value: string | undefined) {
  if (!value) return { date: "", time: "" };
  const local = utcToApplicationDateTime(value);
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}

function bookingErrorMessage(error: unknown): string {
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
  if (message.includes("booking_start_invalid") || message.includes("booking_end_invalid")) {
    return "Enter valid start and end dates and times.";
  }
  if (applicationError.kind === "unauthorized") {
    return "You are not allowed to create this booking.";
  }
  if (applicationError.kind === "network" || applicationError.kind === "server") {
    return "We could not save the booking. Try again.";
  }
  return "We could not create the booking. Check the details and try again.";
}

export function BookingForm({
  resourceName,
  resourceId,
  isAdministrator,
  initialStart,
  initialEnd,
  initialDate,
  onCancel,
  onSuccess,
}: BookingFormProps) {
  const start = initialDateTime(initialStart);
  const end = initialDateTime(initialEnd);
  const [startDate, setStartDate] = useState(start.date || initialDate || "");
  const [startTime, setStartTime] = useState(start.time);
  const [endDate, setEndDate] = useState(end.date || start.date || initialDate || "");
  const [endTime, setEndTime] = useState(end.time);
  const [bookedForUser, setBookedForUser] = useState("");
  const [bookingType, setBookingType] = useState("");
  const [formError, setFormError] = useState("");
  const mutation = useCreateBookingMutation();
  const activeUsers = useQuery({ ...activeUsersQueryOptions(), enabled: isAdministrator });
  const bookingTypes = useQuery({ ...bookingTypesQueryOptions(), enabled: isAdministrator });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    if (!startDate || !startTime || !endDate || !endTime) {
      setFormError("Enter a start and end date and time.");
      return;
    }

    const startValue = applicationDateTimeToUtc(`${startDate}T${startTime}`);
    const endValue = applicationDateTimeToUtc(`${endDate}T${endTime}`);
    if (new Date(endValue) <= new Date(startValue)) {
      setFormError("The end must be after the start.");
      return;
    }
    if (isAdministrator && !bookedForUser) {
      setFormError("Select the user this booking is for.");
      return;
    }

    try {
      await mutation.mutateAsync({
        resource: resourceId,
        start: startValue,
        end: endValue,
        ...(isAdministrator
          ? { booked_for_user: bookedForUser, booking_type: bookingType || null }
          : {}),
      });
      onSuccess();
    } catch {
      // The mutation error is rendered below while preserving the entered form values.
    }
  }

  const error = formError || bookingErrorMessage(mutation.error);

  return (
    <section className="booking-form-surface" aria-labelledby="booking-form-title">
      <header className="booking-form-heading">
        <div>
          <p className="eyebrow">New booking</p>
          <h2 id="booking-form-title">{resourceName}</h2>
        </div>
        <Button type="button" size="compact" onClick={onCancel}>
          Close
        </Button>
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
              step={900}
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
              step={900}
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
                disabled={activeUsers.isPending}
                required
              >
                <option value="">Select a user</option>
                {activeUsers.data?.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Booking type</span>
              <select
                value={bookingType}
                onChange={(event) => setBookingType(event.target.value)}
                disabled={bookingTypes.isPending}
              >
                <option value="">No booking type</option>
                {bookingTypes.data
                  ?.filter((type) => !type.archived_at)
                  .map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
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
          <Button type="submit" variant="primary" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Create booking"}
          </Button>
        </div>
      </form>
    </section>
  );
}
