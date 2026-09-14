import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  activeResourcesQueryOptions,
  archiveResource,
  createResource,
  resourceQueryOptions,
  resourcesQueryOptions,
  updateResource,
  type ActiveResource,
  type Resource,
  type ResourceCreate,
  type ResourceUpdate,
} from "@/api/resources";
import { resourcesKeys } from "@/api/query-keys";
import { createMutationQueue, type MutationRelease } from "@/lib/mutation-queue";

type ResourceSnapshot = {
  id: string;
  list: Resource | undefined;
  active: ActiveResource | undefined;
  detail: Resource | undefined;
  removeIfMissing: boolean;
};
type ResourceMutationContext = ResourceSnapshot & { release: MutationRelease };

const mutationQueue = createMutationQueue();

function optimisticResource(input: ResourceCreate): Resource {
  const now = new Date().toISOString();
  return {
    id: `optimistic-${crypto.randomUUID()}`,
    name: input.name.trim(),
    base_rate_minor_units: input.base_rate_minor_units,
    archived: false,
    created: now,
    updated: now,
  };
}

function sorted(resources: Resource[]): Resource[] {
  return [...resources].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
  );
}

async function snapshot(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  await queryClient.cancelQueries({ queryKey: resourcesKeys.all });
  return {
    id,
    list: queryClient
      .getQueryData<Resource[]>(resourcesKeys.list())
      ?.find((item) => item.id === id),
    active: queryClient
      .getQueryData<ActiveResource[]>(resourcesKeys.active())
      ?.find((item) => item.id === id),
    detail: queryClient.getQueryData<Resource>(resourcesKeys.detail(id)),
    removeIfMissing: false,
  };
}

function restore(queryClient: ReturnType<typeof useQueryClient>, previous: ResourceSnapshot) {
  const previousList = previous.list;
  const previousActive = previous.active;
  queryClient.setQueryData<Resource[]>(resourcesKeys.list(), (items) => {
    if (previousList) {
      if (!items) return items;
      return items.some((item) => item.id === previous.id)
        ? items.map((item) => (item.id === previous.id ? previousList : item))
        : sorted([...items, previousList]);
    }
    return previous.removeIfMissing ? items?.filter((item) => item.id !== previous.id) : items;
  });
  queryClient.setQueryData<ActiveResource[]>(resourcesKeys.active(), (items) => {
    if (previousActive) {
      if (!items) return items;
      return items.some((item) => item.id === previous.id)
        ? items.map((item) => (item.id === previous.id ? previousActive : item))
        : [...items, previousActive];
    }
    return previous.removeIfMissing ? items?.filter((item) => item.id !== previous.id) : items;
  });
  if (previous.detail) {
    queryClient.setQueryData(resourcesKeys.detail(previous.id), previous.detail);
  }
}

function settle(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: resourcesKeys.all });
}

export function useResourcesQuery() {
  return useQuery(resourcesQueryOptions());
}

export function useActiveResourcesQuery() {
  return useQuery(activeResourcesQueryOptions());
}

export function useResourceQuery(id: string) {
  return useQuery(resourceQueryOptions(id));
}

export function useCreateResourceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createResource,
    onMutate: async (input): Promise<ResourceMutationContext> => {
      const resource = optimisticResource(input);
      const release = await mutationQueue.acquire(resource.id);
      const previous = await snapshot(queryClient, resource.id);
      previous.removeIfMissing = true;
      queryClient.setQueryData<Resource[]>(resourcesKeys.list(), (items) =>
        items ? sorted([...items, resource]) : items,
      );
      queryClient.setQueryData<ActiveResource[]>(resourcesKeys.active(), (items) =>
        items
          ? [
              ...items,
              {
                id: resource.id,
                name: resource.name,
                archived: false,
                created: resource.created,
                updated: resource.updated,
              },
            ]
          : items,
      );
      return { ...previous, release };
    },
    onError: (_error, _input, context) => context && restore(queryClient, context),
    onSettled: (_data, _error, _input, context) => {
      return settle(queryClient).finally(() => context?.release());
    },
  });
}

export function useUpdateResourceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ResourceUpdate }) => updateResource(id, input),
    onMutate: async ({ id, input }): Promise<ResourceMutationContext> => {
      const release = await mutationQueue.acquire(id);
      const previous = await snapshot(queryClient, id);
      const patch = { name: input.name.trim(), base_rate_minor_units: input.base_rate_minor_units };
      queryClient.setQueryData<Resource[]>(resourcesKeys.list(), (items) =>
        items
          ? sorted(items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
          : items,
      );
      queryClient.setQueryData<ActiveResource[]>(resourcesKeys.active(), (items) =>
        items?.map((item) => (item.id === id ? { ...item, name: patch.name } : item)),
      );
      queryClient.setQueryData<Resource>(resourcesKeys.detail(id), (item) =>
        item ? { ...item, ...patch } : item,
      );
      return { ...previous, release };
    },
    onError: (_error, _input, context) => context && restore(queryClient, context),
    onSettled: (_data, _error, _input, context) => {
      return settle(queryClient).finally(() => context?.release());
    },
  });
}

export function useArchiveResourceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: archiveResource,
    onMutate: async (id): Promise<ResourceMutationContext> => {
      const release = await mutationQueue.acquire(id);
      const previous = await snapshot(queryClient, id);
      queryClient.setQueryData<Resource[]>(resourcesKeys.list(), (items) =>
        items?.map((item) => (item.id === id ? { ...item, archived: true } : item)),
      );
      queryClient.setQueryData<ActiveResource[]>(resourcesKeys.active(), (items) =>
        items?.filter((item) => item.id !== id),
      );
      queryClient.setQueryData<Resource>(resourcesKeys.detail(id), (item) =>
        item ? { ...item, archived: true } : item,
      );
      return { ...previous, release };
    },
    onError: (_error, _input, context) => context && restore(queryClient, context),
    onSettled: (_data, _error, _input, context) => {
      return settle(queryClient).finally(() => context?.release());
    },
  });
}
