import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  activeUsersQueryOptions,
  createUser,
  getUser,
  resendUserInvitation,
  updateUser,
  userQueryOptions,
  usersQueryOptions,
  type ActiveUser,
  type User,
  type UserCreate,
  type UserUpdate,
} from "@/api/users";
import { usersKeys } from "@/api/query-keys";

type UsersContext = {
  previousUsers: User[] | undefined;
  previousActiveUsers: ActiveUser[] | undefined;
  previousUser: User | undefined;
};

function optimisticUser(input: UserCreate): User {
  const now = new Date().toISOString();
  return {
    id: `optimistic-${crypto.randomUUID()}`,
    first_name: input.first_name.trim(),
    last_name: input.last_name.trim(),
    display_name: `${input.first_name.trim()} ${input.last_name.trim()}`.trim(),
    email: input.email.trim().toLowerCase(),
    group: input.group,
    role: input.role,
    active: true,
    password_setup_pending: true,
    created: now,
    updated: now,
  };
}

function sortUsers(users: User[]): User[] {
  return [...users].sort((left, right) =>
    (left.display_name || left.email).localeCompare(right.display_name || right.email, undefined, {
      sensitivity: "base",
    }),
  );
}

function toActiveUser(user: User): ActiveUser {
  return {
    id: user.id,
    display_name: user.display_name,
    email: user.email,
    group: user.group,
    role: user.role,
  };
}

async function cancelUserQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.cancelQueries({ queryKey: usersKeys.list() }),
    queryClient.cancelQueries({ queryKey: usersKeys.active() }),
  ]);
}

function snapshotUsers(queryClient: ReturnType<typeof useQueryClient>, id?: string): UsersContext {
  return {
    previousUsers: queryClient.getQueryData<User[]>(usersKeys.list()),
    previousActiveUsers: queryClient.getQueryData<ActiveUser[]>(usersKeys.active()),
    previousUser: id ? queryClient.getQueryData<User>(usersKeys.detail(id)) : undefined,
  };
}

function restoreUsers(
  queryClient: ReturnType<typeof useQueryClient>,
  context: UsersContext | undefined,
  id?: string,
) {
  if (!context) return;
  if (context.previousUsers !== undefined)
    queryClient.setQueryData(usersKeys.list(), context.previousUsers);
  if (context.previousActiveUsers !== undefined) {
    queryClient.setQueryData(usersKeys.active(), context.previousActiveUsers);
  }
  if (id && context.previousUser !== undefined) {
    queryClient.setQueryData(usersKeys.detail(id), context.previousUser);
  }
}

export function useUsersQuery() {
  return useQuery(usersQueryOptions());
}

export function useUserQuery(id: string) {
  return useQuery(userQueryOptions(id));
}

export function useActiveUsersQuery() {
  return useQuery(activeUsersQueryOptions());
}

export function useCreateUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createUser,
    onMutate: async (input): Promise<UsersContext> => {
      await cancelUserQueries(queryClient);
      const context = snapshotUsers(queryClient);
      const optimistic = optimisticUser(input);
      queryClient.setQueryData(usersKeys.list(), (users: User[] | undefined) =>
        users ? sortUsers([...users, optimistic]) : users,
      );
      queryClient.setQueryData(usersKeys.active(), (users: ActiveUser[] | undefined) =>
        users ? [...users, toActiveUser(optimistic)] : users,
      );
      return context;
    },
    onError: (_error, _input, context) => restoreUsers(queryClient, context),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: usersKeys.all });
    },
  });
}

export function useUpdateUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UserUpdate }) => updateUser(id, input),
    onMutate: async ({ id, input }): Promise<UsersContext> => {
      await cancelUserQueries(queryClient);
      const context = snapshotUsers(queryClient, id);
      const update = (user: User): User => ({
        ...user,
        ...input,
        first_name: input.first_name?.trim() ?? user.first_name,
        last_name: input.last_name?.trim() ?? user.last_name,
        display_name:
          `${input.first_name?.trim() ?? user.first_name} ${input.last_name?.trim() ?? user.last_name}`.trim(),
        updated: new Date().toISOString(),
      });
      queryClient.setQueryData(usersKeys.list(), (users: User[] | undefined) =>
        users ? sortUsers(users.map((user) => (user.id === id ? update(user) : user))) : users,
      );
      queryClient.setQueryData(usersKeys.detail(id), (user: User | undefined) =>
        user ? update(user) : user,
      );
      queryClient.setQueryData(usersKeys.active(), (users: ActiveUser[] | undefined) => {
        if (!users) return users;
        const listed =
          queryClient.getQueryData<User[]>(usersKeys.list())?.find((user) => user.id === id) ??
          queryClient.getQueryData<User>(usersKeys.detail(id));
        if (!listed) return input.active === false ? users.filter((user) => user.id !== id) : users;
        if (!listed.active) return users.filter((user) => user.id !== id);
        return users.some((user) => user.id === id)
          ? users.map((user) => (user.id === id ? toActiveUser(listed) : user))
          : [...users, toActiveUser(listed)];
      });
      return context;
    },
    onError: (_error, variables, context) => restoreUsers(queryClient, context, variables.id),
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: usersKeys.all });
      void queryClient.invalidateQueries({ queryKey: usersKeys.detail(variables.id) });
    },
  });
}

export function useResendUserInvitationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resendUserInvitation,
    onMutate: async (id): Promise<UsersContext> => {
      await cancelUserQueries(queryClient);
      const context = snapshotUsers(queryClient, id);
      queryClient.setQueryData(usersKeys.list(), (users: User[] | undefined) =>
        users?.map((user) =>
          user.id === id ? { ...user, updated: new Date().toISOString() } : user,
        ),
      );
      return context;
    },
    onError: (_error, id, context) => restoreUsers(queryClient, context, id),
    onSettled: (_data, _error, id) => {
      void queryClient.invalidateQueries({ queryKey: usersKeys.list() });
      void queryClient.invalidateQueries({ queryKey: usersKeys.detail(id) });
    },
  });
}

export { getUser };
