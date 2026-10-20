import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import { calendarResourcesQueryOptions } from "@/api/calendar-resources";
import { Loading } from "@/components/base/Loading";
import { CalendarSurface } from "@/components/calendar/calendar-surface";
import { useTenantSettingsQuery } from "@/hooks/use-tenant-settings";
import { queryClient } from "@/lib/query-client";
import { APPLICATION_TIME_ZONE, formatApplicationDate } from "@/lib/time";
import type { CalendarView } from "@/lib/calendar";

export type { CalendarView } from "@/lib/calendar";

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = dayjs(value);
  return parsed.isValid() && parsed.format("YYYY-MM-DD") === value;
}

export function normalizeCalendarDate(
  value: unknown,
  timeZone = APPLICATION_TIME_ZONE,
  now = new Date(),
): string {
  return isCalendarDate(value) ? value : formatApplicationDate(now, timeZone);
}

export function shouldWaitForTenantSettings(date: string, isPending: boolean): boolean {
  return !date && isPending;
}

export function normalizeCalendarView(value: unknown): CalendarView {
  return value === "day" || value === "month" || value === "week" ? value : "week";
}

export function normalizeCalendarBooking(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function normalizeCalendarBookingMode(
  value: unknown,
  booking: string | undefined,
): "edit" | undefined {
  return booking && value === "edit" ? "edit" : undefined;
}

export const Route = createFileRoute("/_authenticated/calendar")({
  validateSearch: (search: Record<string, unknown>) => {
    const booking = normalizeCalendarBooking(search.booking);
    const bookingMode = normalizeCalendarBookingMode(search.bookingMode, booking);

    return {
      date: isCalendarDate(search.date) ? search.date : "",
      view: normalizeCalendarView(search.view),
      resource: typeof search.resource === "string" ? search.resource : "",
      ...(booking ? { booking } : {}),
      ...(bookingMode ? { bookingMode } : {}),
    };
  },
  loader: () => {
    void queryClient.prefetchQuery(calendarResourcesQueryOptions()).catch(() => undefined);
  },
  component: CalendarPage,
});

function CalendarPage() {
  const search = Route.useSearch();
  const tenantSettings = useTenantSettingsQuery();
  const timeZone = tenantSettings.data?.time_zone ?? APPLICATION_TIME_ZONE;
  if (shouldWaitForTenantSettings(search.date, tenantSettings.isPending)) {
    return <Loading />;
  }
  const calendarSearch = { ...search, date: normalizeCalendarDate(search.date, timeZone) };

  return <CalendarSurface search={calendarSearch} />;
}
