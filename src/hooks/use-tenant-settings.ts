import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  tenantSettingsQueryOptions,
  updateTenantSettings,
  type TenantSettings,
  type TenantSettingsUpdate,
} from "@/api/tenant-settings";
import { tenantSettingsKeys } from "@/api/query-keys";
import { createMutationQueue, type MutationRelease } from "@/lib/mutation-queue";

const mutationQueue = createMutationQueue();

export function useTenantSettingsQuery() {
  return useQuery(tenantSettingsQueryOptions());
}

export function useUpdateTenantSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateTenantSettings,
    onMutate: async (
      input: TenantSettingsUpdate,
    ): Promise<{
      previous: TenantSettings | undefined;
      release: MutationRelease;
    }> => {
      const release = await mutationQueue.acquire("locale");
      await queryClient.cancelQueries({ queryKey: tenantSettingsKeys.current() });
      const previous = queryClient.getQueryData<TenantSettings>(tenantSettingsKeys.current());
      queryClient.setQueryData<TenantSettings>(tenantSettingsKeys.current(), (settings) =>
        settings ? { ...settings, locale: input.locale } : settings,
      );
      return { previous, release };
    },
    onError: (_error, _input, context) => {
      if (context?.previous)
        queryClient.setQueryData(tenantSettingsKeys.current(), context.previous);
    },
    onSettled: (_data, _error, _input, context) =>
      queryClient
        .invalidateQueries({ queryKey: tenantSettingsKeys.current() })
        .finally(() => context?.release()),
  });
}
