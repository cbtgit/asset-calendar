import { afterEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "@/api/client";
import { bookingTypesKeys, groupsKeys, resourcesKeys, usersKeys } from "@/api/query-keys";
import { queryClient } from "@/lib/query-client";
import { Route as BookingTypeRoute } from "./_authenticated/administration.booking-types.$bookingTypeId.edit";
import { Route as GroupRoute } from "./_authenticated/administration.groups.$groupId.edit";
import { Route as ResourceRoute } from "./_authenticated/administration.resources.$resourceId.edit";
import { Route as UserRoute } from "./_authenticated/administration.users.$userId.edit";

const user = {
  id: "user-1",
  first_name: "Ada",
  last_name: "Lovelace",
  display_name: "Ada Lovelace",
  email: "ada@example.test",
  group: "group-1",
  role: "regular" as const,
  active: true,
  password_setup_pending: false,
  created: "2026-01-01T00:00:00Z",
  updated: "2026-01-01T00:00:00Z",
};

const group = {
  id: "group-1",
  name: "Operations",
  created: "2026-01-01T00:00:00Z",
  updated: "2026-01-01T00:00:00Z",
  member_count: 2,
};

const bookingType = {
  id: "booking-type-1",
  tenant: "tenant-id",
  name: "Operations",
  name_normalized: "operations",
  surcharge_minor_units: 1250,
  nonbillable: false,
  color: null,
  archived_at: "",
  created: "2026-01-01T00:00:00Z",
  updated: "2026-01-01T00:00:00Z",
};

const resource = {
  id: "resource-1",
  tenant: "tenant-id",
  name: "Operations",
  name_normalized: "operations",
  base_rate_minor_units: 1250,
  archived_at: "",
  created: "2026-01-01T00:00:00Z",
  updated: "2026-01-01T00:00:00Z",
};

afterEach(() => {
  queryClient.clear();
  vi.restoreAllMocks();
});

it("loads missing detail records and reuses the prefetched records for every edit route", async () => {
  const send = vi.spyOn(pocketbase, "send").mockImplementation(async (path) => {
    if (path === "/api/users/user-1") return user;
    if (path === "/api/groups/group-1") return group;
    throw new Error(`Unexpected request: ${path}`);
  });
  const getOne = vi.fn().mockImplementation(async (id: string) => {
    if (id === bookingType.id) return bookingType;
    if (id === resource.id) return resource;
    throw new Error(`Unexpected record: ${id}`);
  });
  vi.spyOn(pocketbase, "collection").mockReturnValue({ getOne } as never);

  const routes = [
    {
      route: UserRoute,
      param: "userId",
      id: user.id,
      key: usersKeys.detail(user.id),
      record: user,
    },
    {
      route: GroupRoute,
      param: "groupId",
      id: group.id,
      key: groupsKeys.detail(group.id),
      record: group,
    },
    {
      route: BookingTypeRoute,
      param: "bookingTypeId",
      id: bookingType.id,
      key: bookingTypesKeys.detail(bookingType.id),
      record: bookingType,
    },
    {
      route: ResourceRoute,
      param: "resourceId",
      id: resource.id,
      key: resourcesKeys.detail(resource.id),
      record: resource,
    },
  ] as const;

  for (const { route, param, id, key, record } of routes) {
    const loader = route.options.loader as (context: {
      params: Record<string, string>;
    }) => Promise<unknown>;
    await expect(loader({ params: { [param]: id } })).resolves.toEqual(record);
    await expect(loader({ params: { [param]: id } })).resolves.toEqual(record);
    expect(queryClient.getQueryData(key)).toEqual(record);
  }

  expect(send).toHaveBeenCalledTimes(2);
  expect(getOne).toHaveBeenCalledTimes(2);
  expect(queryClient.getQueryData(usersKeys.list())).toBeUndefined();
});
