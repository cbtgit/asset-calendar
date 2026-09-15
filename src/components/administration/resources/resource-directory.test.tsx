import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { afterEach, expect, it, vi } from "vite-plus/test";
import type { Resource } from "@/api/resources";
import { pocketbase } from "@/api/client";
import { resourcesKeys } from "@/api/query-keys";
import { routeTree } from "@/routeTree.gen";

afterEach(() => {
  cleanup();
  pocketbase.authStore.clear();
  vi.restoreAllMocks();
});

it("shows currency-aware rates and links resources to editing without archive controls", async () => {
  pocketbase.authStore.save("token", {
    id: "user-1",
    collectionId: "users",
    collectionName: "users",
    email: "person@example.test",
    role: "administrator",
    tenant: "tenant-id",
  });
  const resource: Resource = {
    id: "resource-1",
    tenant: "tenant-id",
    name: "Operations",
    name_normalized: "operations",
    base_rate_minor_units: 1250,
    archived_at: "",
    created: "2026-01-01T00:00:00Z",
    updated: "2026-01-01T00:00:00Z",
  };
  const queryClient = new QueryClient();
  queryClient.setQueryData(resourcesKeys.list(), [resource]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/administration/resources"] }),
  });
  await router.load();

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  expect(await screen.findByText("Base rate")).toBeTruthy();
  expect(screen.getByText(/12,50/)).toBeTruthy();
  expect(screen.getByText(/kr\./)).toBeTruthy();
  expect((await screen.findByRole("link", { name: "Edit Operations" })).getAttribute("href")).toBe(
    "/administration/resources/resource-1/edit",
  );
  expect(screen.queryByRole("button", { name: /archive/i })).toBeNull();
  expect(screen.queryByText(/tenant settings/i)).toBeNull();
});
