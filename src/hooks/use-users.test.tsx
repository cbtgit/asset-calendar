import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "@/api/client";
import { usersKeys } from "@/api/query-keys";
import type { ActiveUser, User } from "@/api/users";
import { useUpdateUserMutation } from "./use-users";

const user: User = {
  id: "user-1",
  first_name: "Ada",
  last_name: "Lovelace",
  display_name: "Ada Lovelace",
  email: "ada@example.test",
  group: "group-1",
  role: "regular",
  active: true,
  password_setup_pending: false,
  created: "2026-01-01T00:00:00Z",
  updated: "2026-01-01T00:00:00Z",
};

const activeUser: ActiveUser = {
  id: user.id,
  display_name: user.display_name,
  email: user.email,
  group: user.group,
  role: user.role,
};

afterEach(() => {
  vi.restoreAllMocks();
});

it("rolls back user and active-selector caches when an update fails", async () => {
  const error = Object.assign(new Error("forbidden"), { status: 403 });
  vi.spyOn(pocketbase, "send").mockRejectedValue(error);
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  queryClient.setQueryData(usersKeys.list(), [user]);
  queryClient.setQueryData(usersKeys.detail(user.id), user);
  queryClient.setQueryData(usersKeys.active(), [activeUser]);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useUpdateUserMutation(), { wrapper });

  await expect(
    act(() => result.current.mutateAsync({ id: user.id, input: { active: false } })),
  ).rejects.toMatchObject({ kind: "unauthorized" });
  expect(queryClient.getQueryData<User[]>(usersKeys.list())).toEqual([user]);
  expect(queryClient.getQueryData<User>(usersKeys.detail(user.id))).toEqual(user);
  expect(queryClient.getQueryData<ActiveUser[]>(usersKeys.active())).toEqual([activeUser]);
});
