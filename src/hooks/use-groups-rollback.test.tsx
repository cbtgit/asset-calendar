import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "@/api/client";
import { groupsKeys } from "@/api/query-keys";
import { useCreateGroupMutation, useDeleteGroupMutation } from "./use-groups";
import type { Group } from "@/api/groups";

const group: Group = {
  id: "group-1",
  name: "Operations",
  created: "2026-01-01T00:00:00Z",
  updated: "2026-01-01T00:00:00Z",
  member_count: 2,
};

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  queryClient.setQueryData(groupsKeys.list(), [group]);
  return { queryClient, wrapper };
}

afterEach(() => {
  vi.restoreAllMocks();
});

it("rolls back a failed create", async () => {
  const error = Object.assign(new Error("Duplicate"), { status: 409 });
  let rejectCreate!: (reason: unknown) => void;
  const create = vi.fn().mockReturnValue(
    new Promise<never>((_resolve, reject) => {
      rejectCreate = reject;
    }),
  );
  vi.spyOn(pocketbase, "collection").mockReturnValue({ create } as never);
  const { queryClient, wrapper } = setup();
  const { result } = renderHook(() => useCreateGroupMutation(), { wrapper });

  let mutation!: Promise<unknown>;
  await act(async () => {
    mutation = result.current.mutateAsync({ name: "New group" });
    await Promise.resolve();
  });
  expect(queryClient.getQueryData<Group[]>(groupsKeys.list())).toHaveLength(2);
  rejectCreate(error);
  await expect(mutation).rejects.toMatchObject({ kind: "conflict" });
  expect(queryClient.getQueryData<Group[]>(groupsKeys.list())).toEqual([group]);
});

it("rolls back a failed delete", async () => {
  const error = Object.assign(new Error("Delete failed"), { status: 500 });
  let rejectDelete!: (reason: unknown) => void;
  const remove = vi.fn().mockReturnValue(
    new Promise<never>((_resolve, reject) => {
      rejectDelete = reject;
    }),
  );
  vi.spyOn(pocketbase, "collection").mockReturnValue({ delete: remove } as never);
  const { queryClient, wrapper } = setup();
  const { result } = renderHook(() => useDeleteGroupMutation(), { wrapper });

  let mutation!: Promise<unknown>;
  await act(async () => {
    mutation = result.current.mutateAsync("group-1");
    await Promise.resolve();
  });
  expect(queryClient.getQueryData<Group[]>(groupsKeys.list())).toEqual([]);
  rejectDelete(error);
  await expect(mutation).rejects.toMatchObject({ kind: "server" });
  expect(queryClient.getQueryData<Group[]>(groupsKeys.list())).toEqual([group]);
});
