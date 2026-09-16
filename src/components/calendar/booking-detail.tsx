import { Button } from "@/components/base/Button";
import type { CalendarBooking } from "@/api/bookings";
import { utcToApplicationDateTime } from "@/lib/time";

type BookingDetailProps = {
  booking: CalendarBooking;
  isAdministrator: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

function formatDateTime(value: string): string {
  return utcToApplicationDateTime(value).replace("T", " ");
}

export function BookingDetail({
  booking,
  isAdministrator,
  onClose,
  onEdit,
  onDelete,
}: BookingDetailProps) {
  return (
    <section className="booking-form-surface" aria-labelledby="booking-detail-title">
      <header className="booking-form-heading">
        <div>
          <p className="eyebrow">Booking details</p>
          <h2 id="booking-detail-title">{booking.booker_display_name}</h2>
        </div>
        <Button type="button" size="compact" onClick={onClose}>
          Close
        </Button>
      </header>
      <dl className="booking-detail-list">
        <div>
          <dt>Start</dt>
          <dd>{formatDateTime(booking.start)}</dd>
        </div>
        <div>
          <dt>End</dt>
          <dd>{formatDateTime(booking.end)}</dd>
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
