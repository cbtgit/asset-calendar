import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "@/api/client";
import { resourcesKeys } from "@/api/query-keys";
import type { Resource } from "@/api/resources";
import { useArchiveResourceMutation, useUpdateResourceMutation } from "./use-resources";

const resource: Resource = {
  id: "resource-1",
  name: "Room",
  base_rate_minor_units: 100,
  archived: false,
  created: "2026-01-01T00:00:00Z",
  updated: "2026-01-01T00:00:00Z",
};

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  queryClient.setQueryData(resourcesKeys.list(), [resource]);
  queryClient.setQueryData(resourcesKeys.active(), [
    {
      id: resource.id,
      name: resource.name,
      archived: false,
      created: resource.created,
      updated: resource.updated,
    },
  ]);
  return { queryClient, wrapper };
}

afterEach(() => vi.restoreAllMocks());

it("cancels, updates immediately, and rolls back resource updates", async () => {
  let rejectUpdate!: (reason: unknown) => void;
  vi.spyOn(pocketbase, "collection").mockReturnValue({
    update: vi.fn().mockReturnValue(new Promise((_resolve, reject) => (rejectUpdate = reject))),
  } as never);
  vi.spyOn(pocketbase, "send").mockResolvedValue(resource);
  const { queryClient, wrapper } = setup();
  const cancel = vi.spyOn(queryClient, "cancelQueries");
  const { result } = renderHook(() => useUpdateResourceMutation(), { wrapper });

  let mutation!: Promise<unknown>;
  await act(async () => {
    mutation = result.current.mutateAsync({
      id: resource.id,
      input: { name: "Updated", base_rate_minor_units: 200 },
    });
    await Promise.resolve();
  });
  expect(cancel).toHaveBeenCalledWith({ queryKey: resourcesKeys.all });
  expect(queryClient.getQueryData<Resource[]>(resourcesKeys.list())?.[0]?.name).toBe("Updated");
  rejectUpdate(Object.assign(new Error("conflict"), { status: 409 }));
  await expect(mutation).rejects.toMatchObject({ kind: "conflict" });
  expect(queryClient.getQueryData(resourcesKeys.list())).toEqual([resource]);
});

it("removes archived resources from active selection and invalidates after settlement", async () => {
  vi.spyOn(pocketbase, "collection").mockReturnValue({
    update: vi.fn().mockResolvedValue({}),
  } as never);
  vi.spyOn(pocketbase, "send").mockResolvedValue({ ...resource, archived: true });
  const { queryClient, wrapper } = setup();
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const { result } = renderHook(() => useArchiveResourceMutation(), { wrapper });

  await act(() => result.current.mutateAsync(resource.id));

  expect(queryClient.getQueryData(resourcesKeys.active())).toEqual([]);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: resourcesKeys.all });
});
