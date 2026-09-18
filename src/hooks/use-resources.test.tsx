import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { signOut } from "@/api/auth";
import { pocketbase } from "@/api/client";
import type { Resource } from "@/api/resources";
import { resourcesKeys } from "@/api/query-keys";
import { useCreateResourceMutation, useUpdateResourceMutation } from "./use-resources";

const resource: Resource = {
  id: "resource-1",
  tenant: "tenant-id",
  name: "Operations",
  name_normalized: "operations",
  base_rate_minor_units: 1250,
  archived_at: "",
  created: "2026-01-01T00:00:00Z",
  updated: "2026-01-01T00:00:00Z",
};

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  queryClient.setQueryData(resourcesKeys.list(), [resource]);
  queryClient.setQueryData(resourcesKeys.detail(resource.id), resource);
  return { queryClient, wrapper };
}

beforeEach(() => {
  signOut();
  pocketbase.authStore.save("token", {
    id: "user-1",
    collectionId: "users",
    collectionName: "users",
    email: "person@example.test",
    tenant: "tenant-id",
  });
});

afterEach(() => {
  signOut();
  vi.restoreAllMocks();
});

it("optimistically adds and sorts a resource", async () => {
  let resolveCreate!: (value: Resource) => void;
  const create = vi.fn().mockReturnValue(
    new Promise<Resource>((resolve) => {
      resolveCreate = resolve;
    }),
  );
  vi.spyOn(pocketbase, "collection").mockReturnValue({ create } as never);
  const { queryClient, wrapper } = setup();
  const { result } = renderHook(() => useCreateResourceMutation(), { wrapper });

  let mutation!: Promise<unknown>;
  await act(async () => {
    mutation = result.current.mutateAsync({ name: " New resource ", baseRateMinorUnits: 250 });
    await Promise.resolve();
  });
  expect(
    queryClient.getQueryData<Resource[]>(resourcesKeys.list())?.map(({ name }) => name),
  ).toEqual(["New resource", "Operations"]);

  resolveCreate({ ...resource, id: "resource-2", name: "New resource" });
  await mutation;
});

it("rolls back a failed resource update and invalidates the list", async () => {
  const error = Object.assign(new Error("Duplicate"), { status: 409 });
  let rejectUpdate!: (reason: unknown) => void;
  const update = vi.fn().mockReturnValue(
    new Promise<never>((_resolve, reject) => {
      rejectUpdate = reject;
    }),
  );
  vi.spyOn(pocketbase, "collection").mockReturnValue({ update } as never);
  const { queryClient, wrapper } = setup();
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const { result } = renderHook(() => useUpdateResourceMutation(), { wrapper });

  let mutation!: Promise<unknown>;
  await act(async () => {
    mutation = result.current.mutateAsync({
      id: resource.id,
      input: { name: "Duplicate", baseRateMinorUnits: 250 },
    });
    await Promise.resolve();
  });
  expect(queryClient.getQueryData<Resource[]>(resourcesKeys.list())?.[0].name).toBe("Duplicate");
  expect(queryClient.getQueryData<Resource>(resourcesKeys.detail(resource.id))?.name).toBe(
    "Duplicate",
  );

  rejectUpdate(error);
  await expect(mutation).rejects.toMatchObject({ kind: "conflict" });
  expect(queryClient.getQueryData<Resource[]>(resourcesKeys.list())).toEqual([resource]);
  expect(queryClient.getQueryData<Resource>(resourcesKeys.detail(resource.id))).toEqual(resource);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: resourcesKeys.list() });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: resourcesKeys.detail(resource.id) });
});
