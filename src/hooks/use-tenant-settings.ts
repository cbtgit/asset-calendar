import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  tenantSettingsQueryOptions,
  updateTenantSettings,
  type TenantSettingsUpdate,
} from "@/api/tenant-settings";
import { tenantSettingsKeys } from "@/api/query-keys";
import { getAuthSnapshot } from "@/api/auth";

export function useTenantSettingsQuery() {
  return useQuery({
    ...tenantSettingsQueryOptions(),
    enabled: Boolean(getAuthSnapshot().user?.tenant),
  });
}

export function useUpdateTenantSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TenantSettingsUpdate }) =>
      updateTenantSettings(id, input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: tenantSettingsKeys.current() }),
  });
}
