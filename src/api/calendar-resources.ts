import { queryOptions } from "@tanstack/react-query";
import { pocketbase } from "./client";
import { toAppError } from "./errors";
import { calendarKeys } from "./query-keys";

export type CalendarResource = {
  id: string;
  name: string;
};

type CalendarResourcesResponse = {
  items: CalendarResource[];
};

export async function getCalendarResources(): Promise<CalendarResource[]> {
  try {
    const response = await pocketbase.send<CalendarResourcesResponse>("/api/calendar/resources", {
      method: "GET",
    });
    return response.items;
  } catch (cause) {
    throw toAppError(cause);
  }
}

export function calendarResourcesQueryOptions() {
  return queryOptions<CalendarResource[]>({
    queryKey: calendarKeys.resources(),
    queryFn: getCalendarResources,
    staleTime: 2 * 60 * 1000,
  });
}
