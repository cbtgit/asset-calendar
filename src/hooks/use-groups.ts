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
        queryClient.setQueryData(groupsKeys.list(), [...previousGroups, optimisticGroup(input)]);
      }
      return { previousGroups };
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
      await queryClient.cancelQueries({ queryKey: groupsKeys.list() });
      const previousGroups = queryClient.getQueryData<Group[]>(groupsKeys.list());
      queryClient.setQueryData<Group[]>(groupsKeys.list(), (groups) =>
        groups?.map((group) => (group.id === id ? { ...group, name: input.name.trim() } : group)),
      );
      return { previousGroups };
    },
    onError: (_error, _input, context) => {
      if (context?.previousGroups !== undefined) {
        queryClient.setQueryData(groupsKeys.list(), context.previousGroups);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: groupsKeys.list() }),
  });
}

export function useDeleteGroupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteGroup,
    onMutate: async (id): Promise<GroupsContext> => {
      await queryClient.cancelQueries({ queryKey: groupsKeys.list() });
      const previousGroups = queryClient.getQueryData<Group[]>(groupsKeys.list());
      queryClient.setQueryData<Group[]>(groupsKeys.list(), (groups) =>
        groups?.filter((group) => group.id !== id),
      );
      return { previousGroups };
    },
    onError: (_error, _input, context) => {
      if (context?.previousGroups !== undefined) {
        queryClient.setQueryData(groupsKeys.list(), context.previousGroups);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: groupsKeys.list() }),
  });
}
