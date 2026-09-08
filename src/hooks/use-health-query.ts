import { useQuery } from "@tanstack/react-query";
import { healthQueryOptions } from "@/api/health";

export function useHealthQuery() {
  return useQuery(healthQueryOptions());
}
