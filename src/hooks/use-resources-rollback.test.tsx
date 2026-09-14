import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "@/api/client";
import { resourcesKeys } from "@/api/query-keys";
import type { ActiveResource, Resource } from "@/api/resources";
import {
  useArchiveResourceMutation,
  useCreateResourceMutation,
  useUpdateResourceMutation,
} from "./use-resources";

const resource: Resource = {
  id: "resource-1",
  name: "Room",
  base_rate_minor_units: 100,
  archived: false,
  created: "2026-01-01T00:00:00Z",
  updated: "2026-01-01T00:00:00Z",
};
const secondResource: Resource = { ...resource, id: "resource-2", name: "Office" };

function setup() {
  pocketbase.authStore.save("token", {
    id: "admin-1",
    collectionId: "users",
    collectionName: "users",
    tenant: "tenant-1",
    role: "administrator",
  });
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  queryClient.setQueryData(resourcesKeys.list(), [resource, secondResource]);
  queryClient.setQueryData(resourcesKeys.active(), [
    {
      id: resource.id,
      name: resource.name,
      archived: false,
      created: resource.created,
      updated: resource.updated,
    },
    {
      id: secondResource.id,
      name: secondResource.name,
      archived: false,
      created: secondResource.created,
      updated: secondResource.updated,
    },
  ]);
  return { queryClient, wrapper };
}

afterEach(() => {
  pocketbase.authStore.clear();
  vi.restoreAllMocks();
});

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
  expect(
    queryClient
      .getQueryData<Resource[]>(resourcesKeys.list())
      ?.find((item) => item.id === resource.id)?.name,
  ).toBe("Updated");
  rejectUpdate(Object.assign(new Error("conflict"), { status: 409 }));
  await expect(mutation).rejects.toMatchObject({ kind: "conflict" });
  expect(queryClient.getQueryData(resourcesKeys.list())).toEqual([secondResource, resource]);
});

it("adds a non-priced resource to the cached active projection optimistically", async () => {
  vi.spyOn(pocketbase, "collection").mockReturnValue({
    create: vi.fn().mockResolvedValue({ id: "resource-2" }),
  } as never);
  vi.spyOn(pocketbase, "send").mockResolvedValue({ ...resource, id: "resource-2", name: "Office" });
  const { queryClient, wrapper } = setup();
  const { result } = renderHook(() => useCreateResourceMutation(), { wrapper });

  await act(() => result.current.mutateAsync({ name: "Office", base_rate_minor_units: 300 }));

  expect(queryClient.getQueryData(resourcesKeys.active())).toEqual(
    expect.arrayContaining([expect.objectContaining({ name: "Office", archived: false })]),
  );
  expect(
    queryClient.getQueryData<ActiveResource[]>(resourcesKeys.active())?.[1],
  ).not.toHaveProperty("base_rate_minor_units");
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

  expect(queryClient.getQueryData(resourcesKeys.active())).toEqual([
    expect.objectContaining({ id: secondResource.id, name: secondResource.name }),
  ]);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: resourcesKeys.all });
});

it("rolls back only the failed resource during overlapping updates", async () => {
  const rejecters = new Map<string, (reason: unknown) => void>();
  vi.spyOn(pocketbase, "collection").mockReturnValue({
    update: vi.fn().mockImplementation(
      (id: string) =>
        new Promise((_resolve, reject) => {
          rejecters.set(id, reject);
        }),
    ),
  } as never);
  vi.spyOn(pocketbase, "send").mockResolvedValue(resource);
  const { queryClient, wrapper } = setup();
  const { result } = renderHook(() => useUpdateResourceMutation(), { wrapper });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");

  let first!: Promise<unknown>;
  let second!: Promise<unknown>;
  await act(async () => {
    first = result.current.mutateAsync({
      id: resource.id,
      input: { name: "Updated room", base_rate_minor_units: 200 },
    });
    second = result.current.mutateAsync({
      id: secondResource.id,
      input: { name: "Updated office", base_rate_minor_units: 300 },
    });
    await Promise.resolve();
  });

  expect(queryClient.getQueryData<Resource[]>(resourcesKeys.list())).toEqual([
    { ...secondResource, name: "Updated office", base_rate_minor_units: 300 },
    { ...resource, name: "Updated room", base_rate_minor_units: 200 },
  ]);
  rejecters.get(resource.id)?.(new Error("first conflict"));
  await expect(first).rejects.toThrow("first conflict");
  expect(invalidate).not.toHaveBeenCalled();
  expect(queryClient.getQueryData<Resource[]>(resourcesKeys.list())).toEqual([
    { ...secondResource, name: "Updated office", base_rate_minor_units: 300 },
    resource,
  ]);
  rejecters.get(secondResource.id)?.(new Error("second conflict"));
  await expect(second).rejects.toThrow("second conflict");
  expect(invalidate).toHaveBeenCalledTimes(1);
});

it("serializes overlapping updates for one resource", async () => {
  let firstReject!: (reason: unknown) => void;
  let secondReject!: (reason: unknown) => void;
  let calls = 0;
  const update = vi.fn().mockImplementation(
    () =>
      new Promise((_resolve, reject) => {
        calls += 1;
        if (calls === 1) firstReject = reject;
        else secondReject = reject;
      }),
  );
  vi.spyOn(pocketbase, "collection").mockReturnValue({ update } as never);
  const { queryClient, wrapper } = setup();
  const { result } = renderHook(() => useUpdateResourceMutation(), { wrapper });

  const first = result.current.mutateAsync({
    id: resource.id,
    input: { name: "First name", base_rate_minor_units: 200 },
  });
  const second = result.current.mutateAsync({
    id: resource.id,
    input: { name: "Second name", base_rate_minor_units: 300 },
  });
  await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
  expect(
    queryClient
      .getQueryData<Resource[]>(resourcesKeys.list())
      ?.find((item) => item.id === resource.id),
  ).toMatchObject({ name: "First name", base_rate_minor_units: 200 });

  firstReject(new Error("first conflict"));
  await expect(first).rejects.toThrow("first conflict");
  await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
  expect(
    queryClient
      .getQueryData<Resource[]>(resourcesKeys.list())
      ?.find((item) => item.id === resource.id),
  ).toMatchObject({ name: "Second name", base_rate_minor_units: 300 });

  secondReject(new Error("second conflict"));
  await expect(second).rejects.toThrow("second conflict");
  expect(
    queryClient
      .getQueryData<Resource[]>(resourcesKeys.list())
      ?.find((item) => item.id === resource.id),
  ).toEqual(resource);
});
