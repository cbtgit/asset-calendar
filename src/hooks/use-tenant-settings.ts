import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  tenantSettingsQueryOptions,
  updateTenantSettings,
  type TenantSettings,
  type TenantSettingsUpdate,
} from "@/api/tenant-settings";
import { tenantSettingsKeys } from "@/api/query-keys";

export function useTenantSettingsQuery() {
  return useQuery(tenantSettingsQueryOptions());
}

export function useUpdateTenantSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateTenantSettings,
    onMutate: async (input: TenantSettingsUpdate) => {
      await queryClient.cancelQueries({ queryKey: tenantSettingsKeys.current() });
      const previous = queryClient.getQueryData<TenantSettings>(tenantSettingsKeys.current());
      queryClient.setQueryData<TenantSettings>(tenantSettingsKeys.current(), (settings) =>
        settings ? { ...settings, locale: input.locale } : settings,
      );
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous)
        queryClient.setQueryData(tenantSettingsKeys.current(), context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: tenantSettingsKeys.current() }),
  });
}
