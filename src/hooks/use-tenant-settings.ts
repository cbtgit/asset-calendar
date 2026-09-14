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

function captureTenantSettingsKeys() {
  return {
    all: tenantSettingsKeys.all,
    current: tenantSettingsKeys.current(),
  } as const;
}

type TenantSettingsQueryKeys = ReturnType<typeof captureTenantSettingsKeys>;

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
      keys: TenantSettingsQueryKeys;
      release: MutationRelease;
    }> => {
      const keys = captureTenantSettingsKeys();
      const release = await mutationQueue.acquire(`${keys.all[0]}:locale`);
      await queryClient.cancelQueries({ queryKey: keys.all });
      const previous = queryClient.getQueryData<TenantSettings>(keys.current);
      queryClient.setQueryData<TenantSettings>(keys.current, (settings) =>
        settings ? { ...settings, locale: input.locale } : settings,
      );
      return { previous, keys, release };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(context.keys.current, context.previous);
    },
    onSettled: (_data, _error, _input, context) =>
      context &&
      queryClient
        .invalidateQueries({ queryKey: context.keys.current })
        .finally(() => context.release()),
  });
}
