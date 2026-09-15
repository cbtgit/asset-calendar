import { queryOptions } from "@tanstack/react-query";
import { pocketbase } from "./client";
import { toAppError } from "./errors";
import { usersKeys } from "./query-keys";

export type UserRole = "administrator" | "regular";

export type User = {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  email: string;
  group: string;
  role: UserRole;
  active: boolean;
  password_setup_pending: boolean;
  created: string;
  updated: string;
};

export type ActiveUser = {
  id: string;
  display_name: string;
  email: string;
  group: string;
  role: UserRole;
};

export type UserCreate = {
  first_name: string;
  last_name: string;
  email: string;
  group: string;
  role: UserRole;
};

export type UserUpdate = Partial<
  Pick<UserCreate, "first_name" | "last_name" | "group" | "role">
> & {
  active?: boolean;
};

type UserListResponse = { items: User[] };
type ActiveUserListResponse = { items: ActiveUser[] };

async function send<T>(path: string, options: { method: string; body?: unknown }): Promise<T> {
  try {
    return await pocketbase.send<T>(path, options);
  } catch (cause) {
    throw toAppError(cause);
  }
}

export async function getUsers(): Promise<User[]> {
  return (await send<UserListResponse>("/api/users", { method: "GET" })).items;
}

export async function getUser(id: string): Promise<User> {
  return send<User>(`/api/users/${id}`, { method: "GET" });
}

export async function getActiveUsers(): Promise<ActiveUser[]> {
  return (await send<ActiveUserListResponse>("/api/users/active", { method: "GET" })).items;
}

export async function createUser(input: UserCreate): Promise<User> {
  return send<User>("/api/users", { method: "POST", body: input });
}

export async function updateUser(id: string, input: UserUpdate): Promise<User> {
  return send<User>(`/api/users/${id}`, { method: "PATCH", body: input });
}

export async function resendUserInvitation(id: string): Promise<User> {
  return send<User>(`/api/users/${id}`, {
    method: "PATCH",
    body: { action: "resend_invitation" },
  });
}

export function usersQueryOptions() {
  return queryOptions<User[]>({ queryKey: usersKeys.list(), queryFn: getUsers });
}

export function userQueryOptions(id: string) {
  return queryOptions<User>({ queryKey: usersKeys.detail(id), queryFn: () => getUser(id) });
}

export function activeUsersQueryOptions() {
  return queryOptions<ActiveUser[]>({ queryKey: usersKeys.active(), queryFn: getActiveUsers });
}
