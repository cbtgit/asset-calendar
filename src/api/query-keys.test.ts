import { afterEach, expect, it } from "vite-plus/test";
import { pocketbase } from "./client";
import { bookingTypesKeys, resourcesKeys, tenantSettingsKeys } from "./query-keys";

afterEach(() => pocketbase.authStore.clear());

it("scopes F05 server-state keys to the authenticated tenant", () => {
  pocketbase.authStore.save("token", { tenant: "tenant-a" } as never);
  const first = [tenantSettingsKeys.current(), resourcesKeys.list(), bookingTypesKeys.list()];
  pocketbase.authStore.save("token", { tenant: "tenant-b" } as never);
  const second = [tenantSettingsKeys.current(), resourcesKeys.list(), bookingTypesKeys.list()];
  expect(second).not.toEqual(first);
  expect(second[0]).not.toEqual(first[0]);
  expect(second[1]).not.toEqual(first[1]);
  expect(second[2]).not.toEqual(first[2]);
});
