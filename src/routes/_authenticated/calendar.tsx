import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import { CalendarSurface } from "@/components/calendar/calendar-surface";

export type CalendarView = "day" | "week" | "month";

export function normalizeCalendarDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return dayjs().format("YYYY-MM-DD");
  }

  const parsed = dayjs(value);
  return parsed.isValid() && parsed.format("YYYY-MM-DD") === value
    ? value
    : dayjs().format("YYYY-MM-DD");
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
  component: CalendarPage,
});

function CalendarPage() {
  const search = Route.useSearch();

  return <CalendarSurface search={search} />;
}
