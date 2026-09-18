import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import { calendarResourcesQueryOptions } from "@/api/calendar-resources";
import { CalendarSurface } from "@/components/calendar/calendar-surface";
import { queryClient } from "@/lib/query-client";
import { formatApplicationDate } from "@/lib/time";
import type { CalendarView } from "@/lib/calendar";

export type { CalendarView } from "@/lib/calendar";

export function normalizeCalendarDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return formatApplicationDate(new Date());
  }

  const parsed = dayjs(value);
  return parsed.isValid() && parsed.format("YYYY-MM-DD") === value
    ? value
    : formatApplicationDate(new Date());
}

export function normalizeCalendarView(value: unknown): CalendarView {
  return value === "day" || value === "month" || value === "week" ? value : "week";
}

export const Route = createFileRoute("/_authenticated/calendar")({
  validateSearch: (search: Record<string, unknown>) => ({
    date: normalizeCalendarDate(search.date),
    view: normalizeCalendarView(search.view),
    resource: typeof search.resource === "string" ? search.resource : "",
  }),
  loader: () => {
    void queryClient.prefetchQuery(calendarResourcesQueryOptions()).catch(() => undefined);
  },
  component: CalendarPage,
});

function CalendarPage() {
  const search = Route.useSearch();

  return <CalendarSurface search={search} />;
}
