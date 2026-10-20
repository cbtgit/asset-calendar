import { expect, it } from "vite-plus/test";
import { formatApplicationDate } from "@/lib/time";
import {
  normalizeCalendarBooking,
  normalizeCalendarBookingMode,
  normalizeCalendarDate,
  normalizeCalendarView,
} from "./_authenticated/calendar";

it("keeps valid calendar dates and falls back for invalid values", () => {
  expect(normalizeCalendarDate("2026-09-15")).toBe("2026-09-15");
  expect(normalizeCalendarDate("not-a-date")).toBe(formatApplicationDate(new Date()));
  expect(normalizeCalendarDate("2026-02-30")).toBe(formatApplicationDate(new Date()));
});

it("uses the tenant timezone when choosing today's fallback date", () => {
  expect(
    normalizeCalendarDate(
      "not-a-date",
      "America/Los_Angeles",
      new Date("2026-11-30T02:00:00.000Z"),
    ),
  ).toBe("2026-11-29");
});

it("accepts the supported calendar views and defaults unknown values", () => {
  expect(normalizeCalendarView("day")).toBe("day");
  expect(normalizeCalendarView("week")).toBe("week");
  expect(normalizeCalendarView("month")).toBe("month");
  expect(normalizeCalendarView("year")).toBe("week");
});

it("normalizes booking URL state and ignores edit mode without a booking", () => {
  const booking = normalizeCalendarBooking(" booking-1 ");

  expect(booking).toBe("booking-1");
  expect(normalizeCalendarBooking("  ")).toBeUndefined();
  expect(normalizeCalendarBookingMode("edit", booking)).toBe("edit");
  expect(normalizeCalendarBookingMode("edit", undefined)).toBeUndefined();
  expect(normalizeCalendarBookingMode("detail", booking)).toBeUndefined();
});
