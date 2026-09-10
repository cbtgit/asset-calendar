import { afterEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "./client";
import { createGroup, deleteGroup, getGroups, renameGroup } from "./groups";

afterEach(() => {
  vi.restoreAllMocks();
});

it("loads the administrator projection", async () => {
  const groups = [
    {
      id: "group-1",
      name: "Operations",
      created: "2026-01-01T00:00:00Z",
      updated: "2026-01-01T00:00:00Z",
      member_count: 2,
    },
  ];
  const send = vi.spyOn(pocketbase, "send").mockResolvedValue({ items: groups });

  await expect(getGroups()).resolves.toEqual(groups);
  expect(send).toHaveBeenCalledWith("/api/groups", { method: "GET" });
});

it("classifies group conflicts", async () => {
  const conflict = Object.assign(new Error("Duplicate group name"), { status: 409 });
  vi.spyOn(pocketbase, "collection").mockReturnValue({
    create: vi.fn().mockRejectedValue(conflict),
  } as never);

  await expect(createGroup({ name: "Operations" })).rejects.toMatchObject({
    kind: "conflict",
  });
});

it("uses PocketBase records for rename and delete", async () => {
  const update = vi.fn().mockResolvedValue({});
  const remove = vi.fn().mockResolvedValue(true);
  vi.spyOn(pocketbase, "collection").mockReturnValue({ update, delete: remove } as never);
  vi.spyOn(pocketbase, "send").mockResolvedValue({
    id: "group-1",
    name: "Renamed",
    created: "2026-01-01T00:00:00Z",
    updated: "2026-01-02T00:00:00Z",
    member_count: 2,
  });

  await expect(renameGroup("group-1", { name: "Renamed" })).resolves.toMatchObject({
    name: "Renamed",
  });
  await expect(deleteGroup("group-1")).resolves.toBeUndefined();
  expect(update).toHaveBeenCalledWith("group-1", { name: "Renamed" });
  expect(remove).toHaveBeenCalledWith("group-1");
});
