import { queryOptions } from "@tanstack/react-query";
import { pocketbase } from "./client.ts";
import { toAppError } from "./errors.ts";
import { healthKeys } from "./query-keys.ts";

export type HealthResponse = {
  code: number;
  message: string;
  data: Record<string, unknown>;
};

export async function checkHealth(): Promise<HealthResponse> {
  try {
    return (await pocketbase.health.check()) as HealthResponse;
  } catch (cause) {
    throw toAppError(cause);
  }
}

export function healthQueryOptions() {
  return queryOptions({
    queryKey: healthKeys.check(),
    queryFn: checkHealth,
    staleTime: Infinity,
  });
}
