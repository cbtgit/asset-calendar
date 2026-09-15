import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { signOut } from "./auth";
import { pocketbase } from "./client";
import { createResource, getResource, getResources, updateResource } from "./resources";

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

const resource = {
  id: "resource-1",
  tenant: "tenant-id",
  name: "Room A",
  name_normalized: "room a",
  base_rate_minor_units: 1250,
  archived_at: "",
  created: "2026-01-01T00:00:00Z",
  updated: "2026-01-01T00:00:00Z",
};

it("loads resources and one resource for editing", async () => {
  const getFullList = vi.fn().mockResolvedValue([resource]);
  const getOne = vi.fn().mockResolvedValue(resource);
  vi.spyOn(pocketbase, "collection").mockReturnValue({ getFullList, getOne } as never);

  await expect(getResources()).resolves.toEqual([resource]);
  await expect(getResource(resource.id)).resolves.toEqual(resource);
  expect(getFullList).toHaveBeenCalledWith({ sort: "name" });
  expect(getOne).toHaveBeenCalledWith(resource.id);
});

it("creates a resource with a tenant-scoped payload", async () => {
  const create = vi.fn().mockResolvedValue(resource);
  vi.spyOn(pocketbase, "collection").mockReturnValue({ create } as never);

  await expect(createResource({ name: "  Room A  ", baseRateMinorUnits: 1250 })).resolves.toEqual(
    resource,
  );
  expect(create).toHaveBeenCalledWith({ name: "Room A", base_rate_minor_units: 1250 });
});

it("updates a resource without sending protected fields", async () => {
  const update = vi.fn().mockResolvedValue(resource);
  vi.spyOn(pocketbase, "collection").mockReturnValue({ update } as never);

  await expect(
    updateResource(resource.id, { name: "  Updated room  ", baseRateMinorUnits: 1500 }),
  ).resolves.toEqual(resource);
  expect(update).toHaveBeenCalledWith(resource.id, {
    name: "Updated room",
    base_rate_minor_units: 1500,
  });
});
