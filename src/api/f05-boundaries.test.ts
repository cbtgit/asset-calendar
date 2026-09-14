import { afterEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "./client";
import { getActiveResources, getResources } from "./resources";
import { getBookingTypeSelection } from "./booking-types";

afterEach(() => {
  pocketbase.authStore.clear();
  vi.restoreAllMocks();
});

it("keeps rates out of the active-resource response contract", async () => {
  vi.spyOn(pocketbase, "send").mockResolvedValue({
    items: [{ id: "resource-1", name: "Room", archived: false, created: "now", updated: "now" }],
  });

  const active = await getActiveResources();

  expect(active).toEqual([
    { id: "resource-1", name: "Room", archived: false, created: "now", updated: "now" },
  ]);
  expect(active[0]).not.toHaveProperty("base_rate_minor_units");
});

it("keeps administrator resource rates and booking-type selection typed separately", async () => {
  pocketbase.authStore.save("token", {
    id: "admin-1",
    collectionId: "users",
    collectionName: "users",
    tenant: "tenant-1",
    role: "administrator",
  });
  const send = vi.spyOn(pocketbase, "send");
  send
    .mockResolvedValueOnce({
      items: [
        {
          id: "resource-1",
          name: "Room",
          base_rate_minor_units: 1250,
          archived: false,
          created: "now",
          updated: "now",
        },
      ],
    })
    .mockResolvedValueOnce({
      items: [
        {
          id: "type-1",
          name: "Regular",
          system_kind: "regular",
          surcharge_minor_units: 0,
          billable: true,
          resource_blocking: true,
          archived: false,
        },
      ],
    });

  await expect(getResources()).resolves.toMatchObject([{ base_rate_minor_units: 1250 }]);
  await expect(getBookingTypeSelection()).resolves.toMatchObject([
    { system_kind: "regular", surcharge_minor_units: 0 },
  ]);
});
