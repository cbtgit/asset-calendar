import { expect, it } from "vite-plus/test";
import {
  APPLICATION_TIME_ZONE,
  addApplicationHours,
  applicationDateTimeToUtc,
  bookingEditLockStatus,
  calendarSlotBookingRange,
  calendarDateStringToApplicationDateTime,
  formatApplicationDate,
  formatApplicationDateTime,
  utcToApplicationDateTime,
  weeklyBookingReleaseAt,
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

it("calculates the Wednesday release for the selected future week in tenant time", () => {
  expect(
    weeklyBookingReleaseAt(
      "2026-11-02",
      "2026-11-03",
      "12:00",
      3,
      "10:00",
      "Europe/Copenhagen",
      new Date("2026-10-27T12:00:00.000Z"),
    )?.toISOString(),
  ).toBe("2026-10-28T09:00:00.000Z");
});

it("keeps the current week open and treats an end-exclusive Monday boundary correctly", () => {
  const now = new Date("2026-10-27T12:00:00.000Z");
  expect(
    weeklyBookingReleaseAt(
      "2026-10-31",
      "2026-11-02",
      "00:00",
      3,
      "10:00",
      "Europe/Copenhagen",
      now,
    ),
  ).toBeUndefined();
  expect(
    weeklyBookingReleaseAt(
      "2026-10-31",
      "2026-11-02",
      "00:15",
      3,
      "10:00",
      "Europe/Copenhagen",
      now,
    )?.toISOString(),
  ).toBe("2026-10-28T09:00:00.000Z");
});

it("constructs the release instant with the timezone's DST offset for that week", () => {
  expect(
    weeklyBookingReleaseAt(
      "2026-04-06",
      "2026-04-06",
      "12:00",
      3,
      "10:00",
      "Europe/Copenhagen",
      new Date("2026-03-31T12:00:00.000Z"),
    )?.toISOString(),
  ).toBe("2026-04-01T08:00:00.000Z");
});

it("checks current and proposed booking starts against the edit lock independently", () => {
  const now = new Date("2026-10-18T12:00:00.000Z");
  expect(
    bookingEditLockStatus("2026-10-20T12:00:00.000Z", "2026-10-19T11:59:00.000Z", 24, false, now),
  ).toEqual({ currentStartLocked: false, proposedStartLocked: true });
  expect(
    bookingEditLockStatus("2026-10-19T11:00:00.000Z", "2026-10-19T11:00:00.000Z", 24, false, now),
  ).toEqual({ currentStartLocked: true, proposedStartLocked: true });
  expect(
    bookingEditLockStatus("2026-10-19T11:00:00.000Z", "2026-10-19T11:00:00.000Z", 24, true, now),
  ).toEqual({ currentStartLocked: false, proposedStartLocked: false });
});
