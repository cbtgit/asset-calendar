import dayjs from "dayjs";
import { expect, it } from "vite-plus/test";
import { normalizeCalendarDate, normalizeCalendarView } from "./_authenticated/calendar";

it("keeps valid calendar dates and falls back for invalid values", () => {
  expect(normalizeCalendarDate("2026-09-15")).toBe("2026-09-15");
  expect(normalizeCalendarDate("not-a-date")).toBe(dayjs().format("YYYY-MM-DD"));
  expect(normalizeCalendarDate("2026-02-30")).toBe(dayjs().format("YYYY-MM-DD"));
});

it("accepts the supported calendar views and defaults unknown values", () => {
  expect(normalizeCalendarView("day")).toBe("day");
  expect(normalizeCalendarView("week")).toBe("week");
  expect(normalizeCalendarView("month")).toBe("month");
  expect(normalizeCalendarView("year")).toBe("week");
});
