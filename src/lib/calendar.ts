import type { DatesSetArg } from "@fullcalendar/core";
import { APPLICATION_TIME_ZONE, formatApplicationDate } from "./time";

export type CalendarView = "day" | "week" | "month";

export type CalendarSearch = {
  date: string;
  view: CalendarView;
  resource: string;
  booking?: string;
  bookingMode?: "edit";
};

export function getCalendarSearchFromDatesSet(
  range: Pick<DatesSetArg, "view">,
  timeZone = APPLICATION_TIME_ZONE,
): Pick<CalendarSearch, "date" | "view"> {
  const view: CalendarView =
    range.view.type === "dayGridMonth"
      ? "month"
      : range.view.type === "timeGridDay"
        ? "day"
        : "week";

  return {
    view,
    date: formatApplicationDate(range.view.currentStart, timeZone),
  };
}
