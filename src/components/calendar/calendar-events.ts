import type { EventInput } from "@fullcalendar/core";
import type { CalendarBooking } from "@/api/bookings";

export function toCalendarEvents(bookings: CalendarBooking[]): EventInput[] {
  return bookings.map((booking) => ({
    id: booking.id,
    title: booking.booking_type_name
      ? `${booking.booking_type_name} - ${booking.booker_display_name}`
      : booking.booker_display_name,
    start: booking.start,
    end: booking.end,
    ...(booking.booking_type_color
      ? { backgroundColor: booking.booking_type_color, borderColor: booking.booking_type_color }
      : {}),
    extendedProps: { booking },
  }));
}
