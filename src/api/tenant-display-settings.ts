import { queryOptions } from "@tanstack/react-query";
import { pocketbase } from "./client";
import { toAppError } from "./errors";
import { tenantDisplaySettingsKeys } from "./query-keys";
import { queryClient } from "@/lib/query-client";

export type TenantDisplaySettings = {
  locale: string;
  timezone: string;
  currency_code: string;
  heading_title: string;
};

export const DEFAULT_TENANT_DISPLAY_SETTINGS: TenantDisplaySettings = {
  locale: "da-DK",
  timezone: "Europe/Copenhagen",
  currency_code: "DKK",
  heading_title: "Asset Calendar",
};

export async function getTenantDisplaySettings(): Promise<TenantDisplaySettings> {
  try {
    return await pocketbase.send<TenantDisplaySettings>("/api/tenant-settings", {
      method: "GET",
    });
  } catch (cause) {
    throw toAppError(cause);
  }
}

export function tenantDisplaySettingsQueryOptions() {
  return queryOptions<TenantDisplaySettings>({
    queryKey: tenantDisplaySettingsKeys.current(),
    queryFn: getTenantDisplaySettings,
    staleTime: Infinity,
  });
}

export function getTenantDisplaySettingsSnapshot(): TenantDisplaySettings {
  return (
    queryClient.getQueryData<TenantDisplaySettings>(tenantDisplaySettingsKeys.current()) ??
    DEFAULT_TENANT_DISPLAY_SETTINGS
  );
}
