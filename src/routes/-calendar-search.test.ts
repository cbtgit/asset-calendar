import { expect, it } from "vite-plus/test";
import { formatApplicationDate } from "@/lib/time";
import { normalizeCalendarDate, normalizeCalendarView } from "./_authenticated/calendar";

it("keeps valid calendar dates and falls back for invalid values", () => {
  expect(normalizeCalendarDate("2026-09-15")).toBe("2026-09-15");
  expect(normalizeCalendarDate("not-a-date")).toBe(formatApplicationDate(new Date()));
  expect(normalizeCalendarDate("2026-02-30")).toBe(formatApplicationDate(new Date()));
});

it("accepts the supported calendar views and defaults unknown values", () => {
  expect(normalizeCalendarView("day")).toBe("day");
  expect(normalizeCalendarView("week")).toBe("week");
  expect(normalizeCalendarView("month")).toBe("month");
  expect(normalizeCalendarView("year")).toBe("week");
});
