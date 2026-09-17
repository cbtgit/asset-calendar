import { useEffect, useRef } from "react";
import { Button } from "@/components/base/Button";
import { CloseButton } from "@/components/base/CloseButton";
import type { CalendarBooking } from "@/api/bookings";
import { utcToApplicationDateTime } from "@/lib/time";

type BookingDetailProps = {
  booking: CalendarBooking;
  isAdministrator: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  timeZone?: string;
};

function formatDateTime(value: string, timeZone: string): string {
  return utcToApplicationDateTime(value, timeZone).replace("T", " ");
}

export function BookingDetail({
  booking,
  isAdministrator,
  onClose,
  onEdit,
  onDelete,
  timeZone = "Europe/Copenhagen",
}: BookingDetailProps) {
  const surfaceRef = useRef<HTMLElement>(null);

  useEffect(() => {
    surfaceRef.current?.focus();
  }, []);

  return (
    <section
      ref={surfaceRef}
      className="booking-form-surface"
      aria-labelledby="booking-detail-title"
      tabIndex={-1}
    >
      <header className="booking-form-heading">
        <div>
          <p className="eyebrow">Booking details</p>
          <h2 id="booking-detail-title">{booking.booker_display_name}</h2>
        </div>
        <CloseButton
          className="booking-form-close"
          size="compact"
          label="Close booking details"
          onClick={onClose}
        />
      </header>
      <dl className="booking-detail-list">
        <div>
          <dt>Start</dt>
          <dd>{formatDateTime(booking.start, timeZone)}</dd>
        </div>
        <div>
          <dt>End</dt>
          <dd>{formatDateTime(booking.end, timeZone)}</dd>
        </div>
        {isAdministrator && booking.booking_type_name ? (
          <div>
            <dt>Booking type</dt>
            <dd>{booking.booking_type_name}</dd>
          </div>
        ) : null}
      </dl>
      {isAdministrator || booking.can_edit || booking.can_delete ? (
        <div className="booking-detail-actions">
          {booking.can_edit || isAdministrator ? (
            <Button type="button" variant="primary" onClick={onEdit}>
              Edit booking
            </Button>
          ) : null}
          {booking.can_delete || isAdministrator ? (
            <Button type="button" variant="danger" onClick={onDelete}>
              Delete booking
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="booking-detail-note">
          This booking is no longer available to edit or delete.
        </p>
      )}
    </section>
  );
}
