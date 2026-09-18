import { afterEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "@/api/client";
import { calendarKeys } from "@/api/query-keys";
import { queryClient } from "@/lib/query-client";
import { Route } from "./_authenticated/calendar";

const resources = [
  { id: "resource-1", name: "Studio A" },
  { id: "resource-2", name: "Studio B" },
];

afterEach(() => {
  queryClient.clear();
  vi.restoreAllMocks();
});

it("loads and caches calendar resources in the route loader", async () => {
  const send = vi.spyOn(pocketbase, "send").mockResolvedValue({ items: resources });
  const loader = Route.options.loader as () => Promise<unknown>;

  await expect(loader()).resolves.toEqual(resources);
  expect(queryClient.getQueryData(calendarKeys.resources())).toEqual(resources);
  expect(send).toHaveBeenCalledWith("/api/calendar/resources", { method: "GET" });
});
