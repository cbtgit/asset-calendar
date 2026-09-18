import { afterEach, expect, it, vi } from "vite-plus/test";
import { signOut } from "./auth";
import { pocketbase } from "./client";
import { calendarResourcesQueryKey, getCalendarResources } from "./calendar-resources";

afterEach(() => {
  signOut();
  vi.restoreAllMocks();
});

it("loads the calendar-safe active resource projection", async () => {
  const resources = [{ id: "resource-1", name: "Studio A" }];
  const send = vi.spyOn(pocketbase, "send").mockResolvedValue({ items: resources });

  await expect(getCalendarResources()).resolves.toEqual(resources);
  expect(send).toHaveBeenCalledWith("/api/calendar/resources", { method: "GET" });
});

it("includes the authenticated tenant in the calendar resource key", () => {
  pocketbase.authStore.save("token", {
    id: "user-1",
    collectionId: "users",
    collectionName: "users",
    email: "person@example.test",
    tenant: "tenant-id",
  });

  expect(calendarResourcesQueryKey()).toEqual(["calendar", "resources", "tenant-id"]);
});
