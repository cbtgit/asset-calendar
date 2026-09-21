import type { EventInput } from "@fullcalendar/core";
import { DEFAULT_BOOKING_TYPE_COLOR } from "@/api/booking-types";
import type { CalendarBooking } from "@/api/bookings";

export function toCalendarEvents(bookings: CalendarBooking[]): EventInput[] {
  return bookings.map((booking) => {
    const color = booking.booking_type_color || DEFAULT_BOOKING_TYPE_COLOR;

    return {
      id: booking.id,
      title: booking.booking_type_name
        ? `${booking.booking_type_name} - ${booking.booker_display_name}`
        : booking.booker_display_name,
      start: booking.start,
      end: booking.end,
      backgroundColor: color,
      borderColor: color,
      extendedProps: { booking },
    };
  });
}
