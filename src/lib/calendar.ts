import type { DatesSetArg } from "@fullcalendar/core";
import { formatApplicationDate } from "./time";

export type CalendarView = "day" | "week" | "month";

export type CalendarSearch = {
  date: string;
  view: CalendarView;
  resource: string;
};

export function getCalendarSearchFromDatesSet(
  range: Pick<DatesSetArg, "view">,
): Pick<CalendarSearch, "date" | "view"> {
  const view: CalendarView =
    range.view.type === "dayGridMonth"
      ? "month"
      : range.view.type === "timeGridDay"
        ? "day"
        : "week";

  return {
    view,
    date: formatApplicationDate(range.view.currentStart),
  };
}
