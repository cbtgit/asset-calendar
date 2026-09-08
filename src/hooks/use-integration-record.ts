import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  integrationRecordQueryOptions,
  updateIntegrationRecord,
  type IntegrationRecord,
  type IntegrationRecordUpdate,
} from "@/api/integration-record";
import { integrationRecordKeys } from "@/api/query-keys";

export function useIntegrationRecordQuery() {
  return useQuery<IntegrationRecord>(integrationRecordQueryOptions());
}

export function useUpdateIntegrationRecordMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, update }: { id: string; update: IntegrationRecordUpdate }) =>
      updateIntegrationRecord(id, update),
    onSuccess: (record) => {
      queryClient.setQueryData(integrationRecordKeys.current(), record);
    },
  });
}
