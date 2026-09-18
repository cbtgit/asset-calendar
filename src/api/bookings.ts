import { queryOptions } from "@tanstack/react-query";
import { getAuthSnapshot } from "./auth";
import { pocketbase } from "./client";
import { toAppError } from "./errors";
import { bookingsKeys } from "./query-keys";

export type CalendarBooking = {
  id: string;
  resource: string;
  start: string;
  end: string;
  booker_display_name: string;
  can_edit?: boolean;
  can_delete?: boolean;
  booking_type?: string | null;
  booking_type_name?: string | null;
  booking_type_color?: string | null;
  booked_for_user?: string;
  created_by_user?: string;
};

export type BookingCreate = {
  resource: string;
  start: string;
  end: string;
  booked_for_user?: string | null;
  booking_type?: string | null;
};

export type BookingUpdate = {
  id: string;
  start: string;
  end: string;
  booked_for_user?: string | null;
  booking_type?: string | null;
};

export type BookingRange = {
  resourceId: string;
  start: string;
  end: string;
};

type BookingListResponse = {
  items: CalendarBooking[];
};

async function send<T>(path: string, options: { method: string; body?: unknown }): Promise<T> {
  try {
    return await pocketbase.send<T>(path, options);
  } catch (cause) {
    throw toAppError(cause);
  }
}

export async function getCalendarBookings(range: BookingRange): Promise<CalendarBooking[]> {
  const params = new URLSearchParams({
    resource: range.resourceId,
    start: range.start,
    end: range.end,
  });
  return (await send<BookingListResponse>(`/api/calendar/bookings?${params}`, { method: "GET" }))
    .items;
}

export async function createBooking(input: BookingCreate): Promise<CalendarBooking> {
  return send<CalendarBooking>("/api/calendar/bookings", {
    method: "POST",
    body: input,
  });
}

export async function getBooking(id: string): Promise<CalendarBooking> {
  return send<CalendarBooking>(`/api/calendar/bookings/${encodeURIComponent(id)}`, {
    method: "GET",
  });
}

export async function updateBooking({ id, ...input }: BookingUpdate): Promise<CalendarBooking> {
  return send<CalendarBooking>(`/api/calendar/bookings/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: input,
  });
}

export async function deleteBooking(id: string): Promise<{ id: string }> {
  return send<{ id: string }>(`/api/calendar/bookings/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function calendarBookingsQueryOptions(range: BookingRange) {
  const user = getAuthSnapshot().user;
  return queryOptions<CalendarBooking[]>({
    queryKey: bookingsKeys.visible(
      user?.tenant ?? "",
      user?.id ?? "",
      user?.role ?? "",
      range.resourceId,
      range.start,
      range.end,
    ),
    queryFn: () => getCalendarBookings(range),
    enabled: Boolean(range.resourceId && range.start && range.end),
  });
}
