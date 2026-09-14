import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "@/api/client";
import { BookingTypesDirectory } from "./booking-types-directory";

const custom = {
  id: "custom-1",
  name: "After hours",
  system_kind: "custom" as const,
  surcharge_minor_units: 1250,
  billable: true,
  resource_blocking: true,
  archived: false,
};

function renderDirectory() {
  pocketbase.authStore.save("token", {
    id: "admin-1",
    collectionId: "users",
    collectionName: "users",
    tenant: "tenant-1",
    role: "administrator",
  });
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <BookingTypesDirectory />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  pocketbase.authStore.clear();
  vi.restoreAllMocks();
});

it("shows protected system types and localized custom surcharges", async () => {
  vi.spyOn(pocketbase, "send")
    .mockResolvedValueOnce({
      items: [
        { ...custom },
        {
          ...custom,
          id: "regular-1",
          name: "Regular",
          system_kind: "regular",
          surcharge_minor_units: 0,
        },
      ],
    })
    .mockResolvedValueOnce({ id: "tenant-1", currency: "EUR", locale: "de-DE" });
  vi.spyOn(pocketbase, "collection").mockReturnValue({
    getOne: vi.fn().mockResolvedValue({ id: "tenant-1", currency: "EUR", locale: "de-DE" }),
  } as never);

  renderDirectory();

  expect(await screen.findByText(/12,50/)).toBeTruthy();
  expect(screen.getByText("Protected")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Archive" })).toBeTruthy();
});

it("requires archive confirmation and archives only custom types", async () => {
  vi.spyOn(pocketbase, "send")
    .mockResolvedValueOnce({ items: [custom] })
    .mockResolvedValueOnce({ id: "tenant-1", currency: "USD", locale: "en-US" })
    .mockResolvedValueOnce({ ...custom, archived: true });
  const update = vi.fn().mockResolvedValue({});
  vi.spyOn(pocketbase, "collection").mockReturnValue({
    getOne: vi.fn().mockResolvedValue({ id: "tenant-1", currency: "USD", locale: "en-US" }),
    update,
  } as never);

  renderDirectory();
  fireEvent.click(await screen.findByRole("button", { name: "Archive" }));
  expect(update).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog").textContent).toContain("permanent");
  fireEvent.click(screen.getByRole("button", { name: "Archive booking type" }));
  await waitFor(() => expect(update).toHaveBeenCalledWith("custom-1", { archived: true }));
});

it("renders loading, empty, and retryable error states", async () => {
  vi.spyOn(pocketbase, "send").mockReturnValue(new Promise(() => {}) as never);
  renderDirectory();
  expect(screen.getByRole("status").textContent).toBe("Loading booking types…");

  cleanup();
  vi.restoreAllMocks();
  vi.spyOn(pocketbase, "send").mockResolvedValueOnce({ items: [] }).mockResolvedValueOnce({
    id: "tenant-1",
    currency: "GBP",
    locale: "en-GB",
  });
  vi.spyOn(pocketbase, "collection").mockReturnValue({
    getOne: vi.fn().mockResolvedValue({ id: "tenant-1", currency: "GBP", locale: "en-GB" }),
  } as never);
  renderDirectory();
  expect(await screen.findByText("No booking types have been configured yet.")).toBeTruthy();
});
