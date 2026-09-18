import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  tenantSettingsQueryOptions,
  updateTenantSettings,
  type TenantSettingsUpdate,
} from "@/api/tenant-settings";
import { tenantSettingsKeys } from "@/api/query-keys";
import { getAuthSnapshot } from "@/api/auth";
import type { TenantSettings } from "@/api/tenant-settings";

type TenantSettingsContext = {
  previousSettings: TenantSettings | undefined;
};

export function useTenantSettingsQuery() {
  const tenantId = getAuthSnapshot().user?.tenant ?? "";

  return useQuery({
    ...tenantSettingsQueryOptions(tenantId),
    enabled: Boolean(tenantId),
  });
}

export function useUpdateTenantSettingsMutation() {
  const queryClient = useQueryClient();
  const tenantId = getAuthSnapshot().user?.tenant ?? "";
  const queryKey = tenantSettingsKeys.current(tenantId);

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TenantSettingsUpdate }) =>
      updateTenantSettings(id, input),
    onMutate: async ({ input }): Promise<TenantSettingsContext> => {
      await queryClient.cancelQueries({ queryKey });
      const previousSettings = queryClient.getQueryData<TenantSettings>(queryKey);
      queryClient.setQueryData<TenantSettings>(queryKey, (settings) =>
        settings
          ? {
              ...settings,
              site_title: input.siteTitle.trim(),
              booking_lock_hours: input.bookingLockHours,
            }
          : settings,
      );
      return { previousSettings };
    },
    onError: (_error, _input, context) => {
      if (context?.previousSettings !== undefined) {
        queryClient.setQueryData(queryKey, context.previousSettings);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
}
