import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createGroup,
  deleteGroup,
  groupsQueryOptions,
  renameGroup,
  type Group,
  type GroupCreate,
  type GroupRename,
} from "@/api/groups";
import { groupsKeys } from "@/api/query-keys";

type GroupsContext = {
  previousGroups: Group[] | undefined;
  previousGroup: Group | undefined;
};

function optimisticGroup(input: GroupCreate): Group {
  const now = new Date().toISOString();
  return {
    id: `optimistic-${crypto.randomUUID()}`,
    name: input.name.trim(),
    created: now,
    updated: now,
    member_count: 0,
  };
}

function sortGroups(groups: Group[]): Group[] {
  return [...groups].sort((left, right) =>
    left.name.trim().localeCompare(right.name.trim(), undefined, { sensitivity: "base" }),
  );
}

export function useGroupsQuery() {
  return useQuery(groupsQueryOptions());
}

export function useCreateGroupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createGroup,
    onMutate: async (input): Promise<GroupsContext> => {
      await queryClient.cancelQueries({ queryKey: groupsKeys.list() });
      const previousGroups = queryClient.getQueryData<Group[]>(groupsKeys.list());
      if (previousGroups) {
        queryClient.setQueryData(
          groupsKeys.list(),
          sortGroups([...previousGroups, optimisticGroup(input)]),
        );
      }
      return { previousGroups, previousGroup: undefined };
    },
    onError: (_error, _input, context) => {
      if (context?.previousGroups !== undefined) {
        queryClient.setQueryData(groupsKeys.list(), context.previousGroups);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: groupsKeys.list() }),
  });
}

export function useRenameGroupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: GroupRename }) => renameGroup(id, input),
    onMutate: async ({ id, input }): Promise<GroupsContext> => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: groupsKeys.list() }),
        queryClient.cancelQueries({ queryKey: groupsKeys.detail(id) }),
      ]);
      const previousGroups = queryClient.getQueryData<Group[]>(groupsKeys.list());
      const previousGroup = queryClient.getQueryData<Group>(groupsKeys.detail(id));
      queryClient.setQueryData<Group[]>(groupsKeys.list(), (groups) =>
        groups
          ? sortGroups(
              groups.map((group) =>
                group.id === id ? { ...group, name: input.name.trim() } : group,
              ),
            )
          : groups,
      );
      queryClient.setQueryData<Group>(groupsKeys.detail(id), (group) =>
        group ? { ...group, name: input.name.trim() } : group,
      );
      return { previousGroups, previousGroup };
    },
    onError: (_error, _input, context) => {
      if (context?.previousGroups !== undefined) {
        queryClient.setQueryData(groupsKeys.list(), context.previousGroups);
      }
      if (context?.previousGroup !== undefined) {
        queryClient.setQueryData(groupsKeys.detail(_input.id), context.previousGroup);
      }
    },
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: groupsKeys.list() });
      void queryClient.invalidateQueries({ queryKey: groupsKeys.detail(variables.id) });
    },
  });
}

export function useDeleteGroupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteGroup,
    onMutate: async (id): Promise<GroupsContext> => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: groupsKeys.list() }),
        queryClient.cancelQueries({ queryKey: groupsKeys.detail(id) }),
      ]);
      const previousGroups = queryClient.getQueryData<Group[]>(groupsKeys.list());
      const previousGroup = queryClient.getQueryData<Group>(groupsKeys.detail(id));
      queryClient.setQueryData<Group[]>(groupsKeys.list(), (groups) =>
        groups?.filter((group) => group.id !== id),
      );
      if (previousGroup !== undefined) {
        queryClient.removeQueries({ queryKey: groupsKeys.detail(id), exact: true });
      }
      return { previousGroups, previousGroup };
    },
    onError: (_error, id, context) => {
      if (context?.previousGroups !== undefined) {
        queryClient.setQueryData(groupsKeys.list(), context.previousGroups);
      }
      if (context?.previousGroup !== undefined) {
        queryClient.setQueryData(groupsKeys.detail(id), context.previousGroup);
      }
    },
    onSettled: (_data, _error, id) => {
      void queryClient.invalidateQueries({ queryKey: groupsKeys.list() });
      void queryClient.invalidateQueries({ queryKey: groupsKeys.detail(id) });
    },
  });
}
