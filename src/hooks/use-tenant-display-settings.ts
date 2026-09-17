import { useEffect, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getTenantDisplaySettingsSnapshot,
  tenantDisplaySettingsQueryOptions,
  type TenantDisplaySettings,
} from "@/api/tenant-display-settings";
import { tenantDisplaySettingsKeys } from "@/api/query-keys";
import { queryClient } from "@/lib/query-client";

export function useTenantDisplaySettingsQuery() {
  return useQuery(tenantDisplaySettingsQueryOptions());
}

function subscribeToTenantDisplaySettings(onChange: () => void) {
  return queryClient.getQueryCache().subscribe((event) => {
    if (event.query.queryKey[0] === tenantDisplaySettingsKeys.all[0]) onChange();
  });
}

export function useTenantDisplaySettings(): TenantDisplaySettings {
  const settings = useSyncExternalStore(
    subscribeToTenantDisplaySettings,
    getTenantDisplaySettingsSnapshot,
    getTenantDisplaySettingsSnapshot,
  );

  useEffect(() => {
    void queryClient.ensureQueryData(tenantDisplaySettingsQueryOptions()).catch(() => undefined);
  }, []);

  return settings;
}
