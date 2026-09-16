import { useQuery } from "@tanstack/react-query";
import { calendarResourcesQueryOptions } from "@/api/calendar-resources";

export function useCalendarResourcesQuery() {
  return useQuery(calendarResourcesQueryOptions());
}
