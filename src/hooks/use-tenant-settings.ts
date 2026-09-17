import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  tenantSettingsQueryOptions,
  updateTenantSettings,
  type TenantSettings,
  type TenantSettingsUpdate,
} from "@/api/tenant-settings";
import { tenantDisplaySettingsKeys, tenantSettingsKeys } from "@/api/query-keys";
import type { TenantDisplaySettings } from "@/api/tenant-display-settings";

export function useTenantSettingsQuery() {
  return useQuery(tenantSettingsQueryOptions());
}

type TenantSettingsMutationContext = {
  previousSettings: TenantSettings | undefined;
  previousDisplaySettings: TenantDisplaySettings | undefined;
};

function displaySettings(settings: TenantSettings): TenantDisplaySettings {
  return {
    locale: settings.locale,
    timezone: settings.timezone,
    currency_code: settings.currency_code,
    heading_title: settings.heading_title,
  };
}

export function useUpdateTenantSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TenantSettingsUpdate }) =>
      updateTenantSettings(id, input),
    onMutate: async ({ input }): Promise<TenantSettingsMutationContext> => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: tenantSettingsKeys.current() }),
        queryClient.cancelQueries({ queryKey: tenantDisplaySettingsKeys.current() }),
      ]);
      const previousSettings = queryClient.getQueryData<TenantSettings>(
        tenantSettingsKeys.current(),
      );
      const previousDisplaySettings = queryClient.getQueryData<TenantDisplaySettings>(
        tenantDisplaySettingsKeys.current(),
      );
      if (previousSettings) {
        const optimisticSettings = { ...previousSettings, ...input };
        queryClient.setQueryData(tenantSettingsKeys.current(), optimisticSettings);
        queryClient.setQueryData(
          tenantDisplaySettingsKeys.current(),
          displaySettings(optimisticSettings),
        );
      }
      return { previousSettings, previousDisplaySettings };
    },
    onError: (_error, _input, context) => {
      if (context?.previousSettings !== undefined) {
        queryClient.setQueryData(tenantSettingsKeys.current(), context.previousSettings);
      }
      if (context?.previousDisplaySettings !== undefined) {
        queryClient.setQueryData(
          tenantDisplaySettingsKeys.current(),
          context.previousDisplaySettings,
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: tenantSettingsKeys.current() });
      void queryClient.invalidateQueries({ queryKey: tenantDisplaySettingsKeys.current() });
    },
  });
}
