import { expect, it } from "vite-plus/test";
import {
  APPLICATION_TIME_ZONE,
  addApplicationHours,
  applicationDateTimeToUtc,
  calendarSlotBookingRange,
  calendarDateStringToApplicationDateTime,
  formatApplicationDate,
  formatApplicationDateTime,
  utcToApplicationDateTime,
} from "./time";

it("formats dates in the shared application timezone", () => {
  expect(APPLICATION_TIME_ZONE).toBe("Europe/Copenhagen");
  expect(formatApplicationDate(new Date("2026-09-16T22:30:00.000Z"))).toBe("2026-09-17");
  expect(formatApplicationDate(new Date("2026-01-01T23:30:00.000Z"))).toBe("2026-01-02");
});

it("preserves FullCalendar's application-local slot time when converting to UTC", () => {
  const localStart = calendarDateStringToApplicationDateTime("2026-09-17T09:00:00+02:00");
  const utcStart = applicationDateTimeToUtc(localStart);

  expect(localStart).toBe("2026-09-17T09:00");
  expect(utcStart).toBe("2026-09-17T07:00:00.000Z");
  expect(utcToApplicationDateTime(utcStart)).toBe("2026-09-17T09:00");
});

it("formats UTC values in the application locale and timezone", () => {
  expect(formatApplicationDateTime("2026-09-17T06:00:00.000Z")).toBe("17.09.2026, 08.00");
});

it("adds a booking hour in Copenhagen across the spring DST transition", () => {
  const localStart = calendarDateStringToApplicationDateTime("2026-03-29T01:00:00+01:00");
  const localEnd = addApplicationHours(localStart, 1);

  expect(localEnd).toBe("2026-03-29T03:00");
});

it("preserves the clicked instant across the Copenhagen autumn DST fallback", () => {
  expect(calendarSlotBookingRange(new Date("2026-10-25T00:30:00.000Z"))).toEqual({
    start: "2026-10-25T00:30:00.000Z",
    end: "2026-10-25T01:30:00.000Z",
  });
});
