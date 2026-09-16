import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { DEFAULT_MONEY_LOCALE } from "./money";

dayjs.extend(utc);
dayjs.extend(timezone);

export const APPLICATION_TIME_ZONE = "Europe/Copenhagen";

const applicationDateFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: APPLICATION_TIME_ZONE,
  year: "numeric",
});

export function formatApplicationDate(date: Date): string {
  const parts = Object.fromEntries(
    applicationDateFormatter.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function applicationDateTimeToUtc(value: string): string {
  return dayjs.tz(value, APPLICATION_TIME_ZONE).toISOString();
}

export function addApplicationHours(value: string, hours: number): string {
  const startUtc = applicationDateTimeToUtc(value);
  return dayjs
    .utc(startUtc)
    .add(hours, "hour")
    .tz(APPLICATION_TIME_ZONE)
    .format("YYYY-MM-DDTHH:mm");
}

export function calendarSlotBookingRange(start: Date) {
  return {
    start: start.toISOString(),
    end: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
  };
}

export function calendarDateStringToApplicationDateTime(value: string): string {
  return dayjs(value).tz(APPLICATION_TIME_ZONE).format("YYYY-MM-DDTHH:mm");
}

export function utcToApplicationDateTime(value: string): string {
  return dayjs.utc(value).tz(APPLICATION_TIME_ZONE).format("YYYY-MM-DDTHH:mm");
}

export function formatApplicationDateTime(value: string): string {
  return new Intl.DateTimeFormat(DEFAULT_MONEY_LOCALE, {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: APPLICATION_TIME_ZONE,
  }).format(new Date(value));
}
