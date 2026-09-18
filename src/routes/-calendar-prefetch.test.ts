import { afterEach, expect, it, vi } from "vite-plus/test";
import { signOut } from "@/api/auth";
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
  signOut();
  vi.restoreAllMocks();
});

it("loads and caches calendar resources in the route loader", async () => {
  pocketbase.authStore.save("token", {
    id: "user-1",
    collectionId: "users",
    collectionName: "users",
    email: "person@example.test",
    tenant: "tenant-id",
  });
  const send = vi.spyOn(pocketbase, "send").mockResolvedValue({ items: resources });
  const loader = Route.options.loader as () => void;

  expect(loader()).toBeUndefined();
  await vi.waitFor(() =>
    expect(queryClient.getQueryData(calendarKeys.resources("tenant-id"))).toEqual(resources),
  );
  expect(send).toHaveBeenCalledWith("/api/calendar/resources", { method: "GET" });
});
