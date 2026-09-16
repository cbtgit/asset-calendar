import { afterEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "./client";
import { getCalendarResources } from "./calendar-resources";

afterEach(() => {
  vi.restoreAllMocks();
});

it("loads the calendar-safe active resource projection", async () => {
  const resources = [{ id: "resource-1", name: "Studio A" }];
  const send = vi.spyOn(pocketbase, "send").mockResolvedValue({ items: resources });

  await expect(getCalendarResources()).resolves.toEqual(resources);
  expect(send).toHaveBeenCalledWith("/api/calendar/resources", { method: "GET" });
});
