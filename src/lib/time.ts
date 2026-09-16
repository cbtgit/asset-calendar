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
