import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { DEFAULT_MONEY_LOCALE } from "./money";

dayjs.extend(utc);
dayjs.extend(timezone);

export const APPLICATION_TIME_ZONE = "Europe/Copenhagen";

type TimeFormatOptions = {
  timeZone?: string;
  locale?: string;
};

export function formatApplicationDate(date: Date, timeZone = APPLICATION_TIME_ZONE): string {
  const applicationDateFormatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  });
  const parts = Object.fromEntries(
    applicationDateFormatter.formatToParts(date).map(({ type, value }) => [type, value]),
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
  return dayjs(value).tz(timeZone).format("YYYY-MM-DDTHH:mm");
}

export function utcToApplicationDateTime(value: string, timeZone = APPLICATION_TIME_ZONE): string {
  return dayjs.utc(value).tz(timeZone).format("YYYY-MM-DDTHH:mm");
}

export function formatApplicationDateTime(
  value: string,
  { locale = DEFAULT_MONEY_LOCALE, timeZone = APPLICATION_TIME_ZONE }: TimeFormatOptions = {},
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}
