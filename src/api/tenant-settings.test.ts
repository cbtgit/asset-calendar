import { afterEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "./client";
import { getTenantSettings, updateTenantSettings } from "./tenant-settings";

const settings = {
  id: "settings-1",
  tenant: "tenant-id",
  site_title: "Asset Calendar",
  booking_lock_hours: 24,
  created: "2026-01-01T00:00:00Z",
  updated: "2026-01-01T00:00:00Z",
};

afterEach(() => {
  vi.restoreAllMocks();
});

it("loads settings scoped to the authenticated tenant", async () => {
  const getFirstListItem = vi.fn().mockResolvedValue(settings);
  vi.spyOn(pocketbase, "collection").mockReturnValue({ getFirstListItem } as never);

  await expect(getTenantSettings("tenant-id")).resolves.toEqual(settings);
  expect(getFirstListItem).toHaveBeenCalledWith(
    pocketbase.filter("tenant = {:tenant}", { tenant: "tenant-id" }),
  );
});

it("updates only editable tenant settings fields", async () => {
  const update = vi.fn().mockResolvedValue({ ...settings, site_title: "Workshop" });
  vi.spyOn(pocketbase, "collection").mockReturnValue({ update } as never);

  await expect(
    updateTenantSettings(settings.id, { siteTitle: "  Workshop  ", bookingLockHours: 12 }),
  ).resolves.toMatchObject({ site_title: "Workshop", booking_lock_hours: 24 });
  expect(update).toHaveBeenCalledWith(settings.id, {
    site_title: "Workshop",
    booking_lock_hours: 12,
  });
});
