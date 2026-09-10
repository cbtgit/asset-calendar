import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "@/api/client";
import { groupsKeys } from "@/api/query-keys";
import {
  useCreateGroupMutation,
  useDeleteGroupMutation,
  useRenameGroupMutation,
} from "./use-groups";
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

it("optimistically renames and rolls back a failed mutation", async () => {
  const error = Object.assign(new Error("Duplicate"), { status: 409 });
  let rejectMutation!: (reason: unknown) => void;
  const update = vi.fn().mockReturnValue(
    new Promise<never>((_resolve, reject) => {
      rejectMutation = reject;
    }),
  );
  vi.spyOn(pocketbase, "collection").mockReturnValue({ update } as never);
  const { queryClient, wrapper } = setup();
  const { result } = renderHook(() => useRenameGroupMutation(), { wrapper });

  let mutation!: Promise<unknown>;
  await act(async () => {
    mutation = result.current.mutateAsync({ id: "group-1", input: { name: "Renamed" } });
    await Promise.resolve();
  });
  expect(queryClient.getQueryData<Group[]>(groupsKeys.list())?.[0]?.name).toBe("Renamed");
  rejectMutation(error);
  await expect(mutation).rejects.toMatchObject({ kind: "conflict" });
  expect(queryClient.getQueryData<Group[]>(groupsKeys.list())).toEqual([group]);
});

it("optimistically adds a trimmed group", async () => {
  let resolveCreate!: (value: { id: string }) => void;
  const create = vi.fn().mockReturnValue(
    new Promise<{ id: string }>((resolve) => {
      resolveCreate = resolve;
    }),
  );
  vi.spyOn(pocketbase, "collection").mockReturnValue({ create } as never);
  vi.spyOn(pocketbase, "send").mockResolvedValue({
    ...group,
    id: "group-2",
    name: "New group",
    member_count: 0,
  });
  const { queryClient, wrapper } = setup();
  const { result } = renderHook(() => useCreateGroupMutation(), { wrapper });
  const mutation = result.current.mutateAsync({ name: " New group " });

  await act(async () => {
    await Promise.resolve();
  });
  expect(queryClient.getQueryData<Group[]>(groupsKeys.list())).toHaveLength(2);
  expect(queryClient.getQueryData<Group[]>(groupsKeys.list())?.[1]?.name).toBe("New group");
  resolveCreate({ id: "group-2" });
  await mutation;
});

it("optimistically deletes and reconciles after settlement", async () => {
  const remove = vi.fn().mockResolvedValue(true);
  vi.spyOn(pocketbase, "collection").mockReturnValue({ delete: remove } as never);
  const { queryClient, wrapper } = setup();
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const { result } = renderHook(() => useDeleteGroupMutation(), { wrapper });

  await act(async () => {
    await result.current.mutateAsync("group-1");
  });
  expect(queryClient.getQueryData<Group[]>(groupsKeys.list())).toEqual([]);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: groupsKeys.list() });
});
