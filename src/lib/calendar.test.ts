import type { DatesSetArg } from "@fullcalendar/core";
import { expect, it } from "vite-plus/test";
import { getCalendarSearchFromDatesSet } from "./calendar";

it("uses the viewed month instead of FullCalendar's spillover range start", () => {
  const range = {
    start: new Date("2026-08-31T00:00:00.000Z"),
    startStr: "2026-08-31",
    view: {
      type: "dayGridMonth",
      currentStart: new Date("2026-09-01T00:00:00.000Z"),
    },
  } as DatesSetArg;

  expect(getCalendarSearchFromDatesSet(range)).toEqual({ view: "month", date: "2026-09-01" });
});
