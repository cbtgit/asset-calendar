import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createResource,
  resourcesQueryOptions,
  updateResource,
  type Resource,
  type ResourceCreate,
  type ResourceUpdate,
} from "@/api/resources";
import { resourcesKeys } from "@/api/query-keys";
import { getAuthSnapshot } from "@/api/auth";

type ResourcesContext = {
  previousResources: Resource[] | undefined;
  previousResource: Resource | undefined;
};

function optimisticResource(input: ResourceCreate): Resource {
  const now = new Date().toISOString();
  const name = input.name.trim();
  return {
    id: `optimistic-${crypto.randomUUID()}`,
    tenant: getAuthSnapshot().user?.tenant ?? "",
    name,
    name_normalized: name.toLowerCase(),
    base_rate_minor_units: input.baseRateMinorUnits ?? 0,
    archived_at: "",
    created: now,
    updated: now,
  };
}

function sortResources(resources: Resource[]): Resource[] {
  return [...resources].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
  );
}

export function useResourcesQuery() {
  return useQuery(resourcesQueryOptions());
}

export function useCreateResourceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createResource,
    onMutate: async (input): Promise<ResourcesContext> => {
      await queryClient.cancelQueries({ queryKey: resourcesKeys.list() });
      const previousResources = queryClient.getQueryData<Resource[]>(resourcesKeys.list());
      if (previousResources) {
        queryClient.setQueryData(
          resourcesKeys.list(),
          sortResources([...previousResources, optimisticResource(input)]),
        );
      }
      return { previousResources, previousResource: undefined };
    },
    onError: (_error, _input, context) => {
      if (context?.previousResources !== undefined) {
        queryClient.setQueryData(resourcesKeys.list(), context.previousResources);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: resourcesKeys.list() }),
  });
}

export function useUpdateResourceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ResourceUpdate }) => updateResource(id, input),
    onMutate: async ({ id, input }): Promise<ResourcesContext> => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: resourcesKeys.list() }),
        queryClient.cancelQueries({ queryKey: resourcesKeys.detail(id) }),
      ]);
      const previousResources = queryClient.getQueryData<Resource[]>(resourcesKeys.list());
      const previousResource = queryClient.getQueryData<Resource>(resourcesKeys.detail(id));
      const update = (resource: Resource): Resource => ({
        ...resource,
        name: input.name.trim(),
        name_normalized: input.name.trim().toLowerCase(),
        base_rate_minor_units: input.baseRateMinorUnits ?? 0,
      });
      queryClient.setQueryData<Resource[]>(resourcesKeys.list(), (resources) =>
        resources
          ? sortResources(
              resources.map((resource) => (resource.id === id ? update(resource) : resource)),
            )
          : resources,
      );
      queryClient.setQueryData<Resource>(resourcesKeys.detail(id), (resource) =>
        resource ? update(resource) : resource,
      );
      return { previousResources, previousResource };
    },
    onError: (_error, variables, context) => {
      if (context?.previousResources !== undefined) {
        queryClient.setQueryData(resourcesKeys.list(), context.previousResources);
      }
      if (context?.previousResource !== undefined) {
        queryClient.setQueryData(resourcesKeys.detail(variables.id), context.previousResource);
      }
    },
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: resourcesKeys.list() });
      void queryClient.invalidateQueries({ queryKey: resourcesKeys.detail(variables.id) });
    },
  });
}
