import { queryOptions } from "@tanstack/react-query";
import { getAuthSnapshot } from "./auth";
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

export function calendarResourcesQueryKey() {
  return calendarKeys.resources(getAuthSnapshot().user?.tenant ?? "anonymous");
}

export function calendarResourcesQueryOptions() {
  const tenantId = getAuthSnapshot().user?.tenant;

  return queryOptions<CalendarResource[]>({
    queryKey: calendarResourcesQueryKey(),
    queryFn: getCalendarResources,
    enabled: Boolean(tenantId),
    staleTime: 2 * 60 * 1000,
  });
}
