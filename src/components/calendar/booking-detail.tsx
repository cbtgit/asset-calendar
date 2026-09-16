import { Button } from "@/components/base/Button";
import type { CalendarBooking } from "@/api/bookings";
import { utcToApplicationDateTime } from "@/lib/time";

type BookingDetailProps = {
  booking: CalendarBooking;
  isAdministrator: boolean;
  onClose: () => void;
};

function formatDateTime(value: string): string {
  return utcToApplicationDateTime(value).replace("T", " ");
}

export function BookingDetail({ booking, isAdministrator, onClose }: BookingDetailProps) {
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
      <p className="booking-detail-note">Editing and deletion will be available in a later step.</p>
    </section>
  );
}
