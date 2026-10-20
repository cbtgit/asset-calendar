import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { DEFAULT_MONEY_LOCALE } from "./money";

dayjs.extend(utc);
dayjs.extend(timezone);

export const APPLICATION_TIME_ZONE = "Europe/Copenhagen";

export function formatApplicationDate(date: Date, timeZone = APPLICATION_TIME_ZONE): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      month: "2-digit",
      timeZone,
      year: "numeric",
    })
      .formatToParts(date)
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function applicationDateTimeToUtc(value: string, timeZone = APPLICATION_TIME_ZONE): string {
  return dayjs.tz(value, timeZone).toISOString();
}

export function addApplicationHours(
  value: string,
  hours: number,
  timeZone = APPLICATION_TIME_ZONE,
): string {
  const startUtc = applicationDateTimeToUtc(value, timeZone);
  return dayjs.utc(startUtc).add(hours, "hour").tz(timeZone).format("YYYY-MM-DDTHH:mm");
}

export function calendarSlotBookingRange(start: Date) {
  return {
    start: start.toISOString(),
    end: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
  };
}

export function calendarDateStringToApplicationDateTime(
  value: string,
  timeZone = APPLICATION_TIME_ZONE,
): string {
  const hasOffset = /(?:Z|[+-]\d{2}:\d{2})$/.test(value);
  const parsed = hasOffset ? dayjs(value).tz(timeZone) : dayjs.tz(value, timeZone);
  return parsed.format("YYYY-MM-DDTHH:mm");
}

export function utcToApplicationDateTime(value: string, timeZone = APPLICATION_TIME_ZONE): string {
  return dayjs.utc(value).tz(timeZone).format("YYYY-MM-DDTHH:mm");
}

export function formatApplicationDateTime(value: string, timeZone = APPLICATION_TIME_ZONE): string {
  return new Intl.DateTimeFormat(DEFAULT_MONEY_LOCALE, {
    dateStyle: "short",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

function mondayOfLocalDate(value: dayjs.Dayjs, timeZone: string): string {
  const localDate = dayjs.utc(value.tz(timeZone).format("YYYY-MM-DD"));
  const weekday = localDate.day() || 7;
  return localDate.subtract(weekday - 1, "day").format("YYYY-MM-DD");
}

export function weeklyBookingReleaseAt(
  startDate: string,
  endDate: string,
  endTime: string,
  releaseWeekday: number,
  releaseTime: string,
  timeZone: string,
  now = new Date(),
): Date | undefined {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
    (endDate !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) ||
    !Number.isInteger(releaseWeekday) ||
    releaseWeekday < 1 ||
    releaseWeekday > 7 ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(releaseTime)
  ) {
    return undefined;
  }

  const start = dayjs.tz(`${startDate}T12:00`, timeZone);
  if (!start.isValid() || start.format("YYYY-MM-DD") !== startDate) return undefined;

  const selectedEndDate = endDate || startDate;
  const selectedEndTime = endTime || "23:59";
  const end = dayjs.tz(`${selectedEndDate}T${selectedEndTime}`, timeZone);
  if (!end.isValid() || end.format("YYYY-MM-DD") !== selectedEndDate) return undefined;
  const finalBookedInstant = end.subtract(1, "millisecond");

  const targetWeek = mondayOfLocalDate(finalBookedInstant, timeZone);
  const currentWeek = mondayOfLocalDate(dayjs(now), timeZone);
  if (targetWeek <= currentWeek) return undefined;

  const releaseDate = dayjs
    .utc(`${targetWeek}T00:00:00Z`)
    .subtract(7, "day")
    .add(releaseWeekday - 1, "day")
    .format("YYYY-MM-DD");
  const release = dayjs.tz(`${releaseDate}T${releaseTime}`, timeZone);
  return release.isValid() ? release.toDate() : undefined;
}

export function bookingEditLockStatus(
  currentStart: string | undefined,
  proposedStart: string | undefined,
  bookingLockHours: number,
  isAdministrator: boolean,
  now = new Date(),
) {
  const lockMilliseconds =
    Number.isFinite(bookingLockHours) && bookingLockHours > 0
      ? bookingLockHours * 60 * 60 * 1000
      : 0;
  const isLocked = (value: string | undefined) => {
    if (isAdministrator || lockMilliseconds === 0 || !value) return false;
    const start = Date.parse(value);
    return Number.isFinite(start) && start - now.getTime() < lockMilliseconds;
  };

  return {
    currentStartLocked: isLocked(currentStart),
    proposedStartLocked: isLocked(proposedStart),
  };
}
