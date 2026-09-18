import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { calendarResourcesQueryKey, type CalendarResource } from "@/api/calendar-resources";
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
  previousCalendarResources: CalendarResource[] | undefined;
  calendarResourcesKey: ReturnType<typeof calendarResourcesQueryKey>;
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

function sortCalendarResources(resources: CalendarResource[]): CalendarResource[] {
  return [...resources].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
  );
}

function toCalendarResource(resource: Resource): CalendarResource {
  return { id: resource.id, name: resource.name };
}

export function useResourcesQuery() {
  return useQuery(resourcesQueryOptions());
}

export function useCreateResourceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createResource,
    onMutate: async (input): Promise<ResourcesContext> => {
      const calendarResourcesKey = calendarResourcesQueryKey();
      await Promise.all([
        queryClient.cancelQueries({ queryKey: resourcesKeys.list() }),
        queryClient.cancelQueries({ queryKey: calendarResourcesKey }),
      ]);
      const previousResources = queryClient.getQueryData<Resource[]>(resourcesKeys.list());
      const previousCalendarResources =
        queryClient.getQueryData<CalendarResource[]>(calendarResourcesKey);
      const optimistic = optimisticResource(input);
      if (previousResources) {
        queryClient.setQueryData(
          resourcesKeys.list(),
          sortResources([...previousResources, optimistic]),
        );
      }
      if (previousCalendarResources) {
        queryClient.setQueryData(
          calendarResourcesKey,
          sortCalendarResources([...previousCalendarResources, toCalendarResource(optimistic)]),
        );
      }
      return {
        previousResources,
        previousResource: undefined,
        previousCalendarResources,
        calendarResourcesKey,
      };
    },
    onError: (_error, _input, context) => {
      if (context?.previousResources !== undefined) {
        queryClient.setQueryData(resourcesKeys.list(), context.previousResources);
      }
      if (context?.previousCalendarResources !== undefined) {
        queryClient.setQueryData(context.calendarResourcesKey, context.previousCalendarResources);
      }
    },
    onSettled: (_data, _error, _input, context) => {
      void queryClient.invalidateQueries({ queryKey: resourcesKeys.list() });
      if (context) {
        void queryClient.invalidateQueries({ queryKey: context.calendarResourcesKey });
      }
    },
  });
}

export function useUpdateResourceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ResourceUpdate }) => updateResource(id, input),
    onMutate: async ({ id, input }): Promise<ResourcesContext> => {
      const calendarResourcesKey = calendarResourcesQueryKey();
      await Promise.all([
        queryClient.cancelQueries({ queryKey: resourcesKeys.list() }),
        queryClient.cancelQueries({ queryKey: resourcesKeys.detail(id) }),
        queryClient.cancelQueries({ queryKey: calendarResourcesKey }),
      ]);
      const previousResources = queryClient.getQueryData<Resource[]>(resourcesKeys.list());
      const previousResource = queryClient.getQueryData<Resource>(resourcesKeys.detail(id));
      const previousCalendarResources =
        queryClient.getQueryData<CalendarResource[]>(calendarResourcesKey);
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
      queryClient.setQueryData<CalendarResource[]>(calendarResourcesKey, (resources) =>
        resources
          ? sortCalendarResources(
              resources.map((resource) =>
                resource.id === id ? { ...resource, name: input.name.trim() } : resource,
              ),
            )
          : resources,
      );
      return {
        previousResources,
        previousResource,
        previousCalendarResources,
        calendarResourcesKey,
      };
    },
    onError: (_error, variables, context) => {
      if (context?.previousResources !== undefined) {
        queryClient.setQueryData(resourcesKeys.list(), context.previousResources);
      }
      if (context?.previousResource !== undefined) {
        queryClient.setQueryData(resourcesKeys.detail(variables.id), context.previousResource);
      }
      if (context?.previousCalendarResources !== undefined) {
        queryClient.setQueryData(context.calendarResourcesKey, context.previousCalendarResources);
      }
    },
    onSettled: (_data, _error, variables, context) => {
      void queryClient.invalidateQueries({ queryKey: resourcesKeys.list() });
      void queryClient.invalidateQueries({ queryKey: resourcesKeys.detail(variables.id) });
      if (context) {
        void queryClient.invalidateQueries({ queryKey: context.calendarResourcesKey });
      }
    },
  });
}
