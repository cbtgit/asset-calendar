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
type ResourceMutationContext = ResourceSnapshot & {
  keys: ResourceQueryKeys;
  release: MutationRelease;
};

const mutationQueue = createMutationQueue();
const pendingMutations = new Map<string, number>();

function captureResourceKeys() {
  const all = resourcesKeys.all;
  return {
    all,
    list: [...all, "list"] as const,
    active: [...all, "active"] as const,
    detail: (id: string) => [...all, "detail", id] as const,
  } as const;
}

type ResourceQueryKeys = ReturnType<typeof captureResourceKeys>;

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

async function snapshot(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
  keys: ResourceQueryKeys,
) {
  await queryClient.cancelQueries({ queryKey: keys.all });
  return {
    id,
    list: queryClient.getQueryData<Resource[]>(keys.list)?.find((item) => item.id === id),
    active: queryClient.getQueryData<ActiveResource[]>(keys.active)?.find((item) => item.id === id),
    detail: queryClient.getQueryData<Resource>(keys.detail(id)),
    removeIfMissing: false,
  };
}

function restore(
  queryClient: ReturnType<typeof useQueryClient>,
  previous: ResourceSnapshot,
  keys: ResourceQueryKeys,
) {
  const previousList = previous.list;
  const previousActive = previous.active;
  queryClient.setQueryData<Resource[]>(keys.list, (items) => {
    if (previousList) {
      if (!items) return items;
      return items.some((item) => item.id === previous.id)
        ? items.map((item) => (item.id === previous.id ? previousList : item))
        : sorted([...items, previousList]);
    }
    return previous.removeIfMissing ? items?.filter((item) => item.id !== previous.id) : items;
  });
  queryClient.setQueryData<ActiveResource[]>(keys.active, (items) => {
    if (previousActive) {
      if (!items) return items;
      return items.some((item) => item.id === previous.id)
        ? items.map((item) => (item.id === previous.id ? previousActive : item))
        : [...items, previousActive];
    }
    return previous.removeIfMissing ? items?.filter((item) => item.id !== previous.id) : items;
  });
  if (previous.detail) {
    queryClient.setQueryData(keys.detail(previous.id), previous.detail);
  }
}

function beginMutation(keys: ResourceQueryKeys) {
  const scope = keys.all[0];
  pendingMutations.set(scope, (pendingMutations.get(scope) ?? 0) + 1);
}

function settle(
  queryClient: ReturnType<typeof useQueryClient>,
  keys: ResourceQueryKeys,
  release: MutationRelease | undefined,
) {
  const scope = keys.all[0];
  const remaining = (pendingMutations.get(scope) ?? 1) - 1;
  if (remaining === 0) pendingMutations.delete(scope);
  else pendingMutations.set(scope, remaining);
  return (
    remaining === 0 ? queryClient.invalidateQueries({ queryKey: keys.all }) : Promise.resolve()
  ).finally(() => release?.());
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
      const keys = captureResourceKeys();
      const resource = optimisticResource(input);
      beginMutation(keys);
      const release = await mutationQueue.acquire(`${keys.all[0]}:${resource.id}`);
      const previous = await snapshot(queryClient, resource.id, keys);
      previous.removeIfMissing = true;
      queryClient.setQueryData<Resource[]>(keys.list, (items) =>
        items ? sorted([...items, resource]) : items,
      );
      queryClient.setQueryData<ActiveResource[]>(keys.active, (items) =>
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
      return { ...previous, keys, release };
    },
    onError: (_error, _input, context) => context && restore(queryClient, context, context.keys),
    onSettled: (_data, _error, _input, context) => {
      return context && settle(queryClient, context.keys, context.release);
    },
  });
}

export function useUpdateResourceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ResourceUpdate }) => updateResource(id, input),
    onMutate: async ({ id, input }): Promise<ResourceMutationContext> => {
      const keys = captureResourceKeys();
      beginMutation(keys);
      const release = await mutationQueue.acquire(`${keys.all[0]}:${id}`);
      const previous = await snapshot(queryClient, id, keys);
      const patch = { name: input.name.trim(), base_rate_minor_units: input.base_rate_minor_units };
      queryClient.setQueryData<Resource[]>(keys.list, (items) =>
        items
          ? sorted(items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
          : items,
      );
      queryClient.setQueryData<ActiveResource[]>(keys.active, (items) =>
        items?.map((item) => (item.id === id ? { ...item, name: patch.name } : item)),
      );
      queryClient.setQueryData<Resource>(keys.detail(id), (item) =>
        item ? { ...item, ...patch } : item,
      );
      return { ...previous, keys, release };
    },
    onError: (_error, _input, context) => context && restore(queryClient, context, context.keys),
    onSettled: (_data, _error, _input, context) => {
      return context && settle(queryClient, context.keys, context.release);
    },
  });
}

export function useArchiveResourceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: archiveResource,
    onMutate: async (id): Promise<ResourceMutationContext> => {
      const keys = captureResourceKeys();
      beginMutation(keys);
      const release = await mutationQueue.acquire(`${keys.all[0]}:${id}`);
      const previous = await snapshot(queryClient, id, keys);
      queryClient.setQueryData<Resource[]>(keys.list, (items) =>
        items?.map((item) => (item.id === id ? { ...item, archived: true } : item)),
      );
      queryClient.setQueryData<ActiveResource[]>(keys.active, (items) =>
        items?.filter((item) => item.id !== id),
      );
      queryClient.setQueryData<Resource>(keys.detail(id), (item) =>
        item ? { ...item, archived: true } : item,
      );
      return { ...previous, keys, release };
    },
    onError: (_error, _input, context) => context && restore(queryClient, context, context.keys),
    onSettled: (_data, _error, _input, context) => {
      return context && settle(queryClient, context.keys, context.release);
    },
  });
}
