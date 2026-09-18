import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { afterEach, expect, it, vi } from "vite-plus/test";
import type { BookingType } from "@/api/booking-types";
import { pocketbase } from "@/api/client";
import { bookingTypesKeys } from "@/api/query-keys";
import { routeTree } from "@/routeTree.gen";

afterEach(() => {
  cleanup();
  pocketbase.authStore.clear();
  vi.restoreAllMocks();
});

function saveAdministrator() {
  pocketbase.authStore.save("token", {
    id: "user-1",
    collectionId: "users",
    collectionName: "users",
    email: "person@example.test",
    role: "administrator",
    tenant: "tenant-id",
  });
}

it("links each booking type to its edit route", async () => {
  saveAdministrator();
  const queryClient = new QueryClient();
  const bookingType: BookingType = {
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
  queryClient.setQueryData(bookingTypesKeys.list(), [bookingType]);

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/administration/booking-types"] }),
  });
  await router.load();
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  expect(await screen.findByText("Booking type")).toBeTruthy();
  expect(screen.getByText("Hourly price")).toBeTruthy();
  expect(screen.getByText(/12,50/)).toBeTruthy();
  expect(screen.getByText(/kr\./)).toBeTruthy();
  expect((await screen.findByRole("link", { name: "Edit Operations" })).getAttribute("href")).toBe(
    "/administration/booking-types/booking-type-1/edit",
  );
});

it("loads the selected booking type in the edit route", async () => {
  saveAdministrator();
  vi.spyOn(pocketbase, "collection").mockReturnValue({
    getOne: vi.fn().mockResolvedValue({
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
    }),
  } as never);
  const queryClient = new QueryClient();
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: ["/administration/booking-types/booking-type-1/edit"],
    }),
  });
  await router.load();

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  expect(((await screen.findByLabelText("Booking type")) as HTMLInputElement).value).toBe(
    "Operations",
  );
  expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
});
