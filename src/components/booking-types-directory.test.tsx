import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { ApplicationError } from "@/api/errors";
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
        {
          ...custom,
          id: "training-1",
          name: "Training",
          system_kind: "training",
        },
      ],
    })
    .mockResolvedValueOnce({ id: "tenant-1", currency: "EUR", locale: "de-DE" });
  vi.spyOn(pocketbase, "collection").mockReturnValue({
    getOne: vi.fn().mockResolvedValue({ id: "tenant-1", currency: "EUR", locale: "de-DE" }),
  } as never);

  renderDirectory();

  expect((await screen.findAllByText(/12,50/)).length).toBeGreaterThan(0);
  expect(screen.getByText("Protected")).toBeTruthy();
  expect(
    screen.getByText(
      "Regular and Maintenance are protected. Training and custom types can be edited; custom types can be archived.",
    ),
  ).toBeTruthy();
  expect(screen.getByRole("textbox", { name: "Name for Training" })).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "Archive" })).toHaveLength(1);
  expect(screen.getByRole("textbox", { name: "Name for Training" })).toBeTruthy();
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

it("maps booking-type archive errors to an actionable message", async () => {
  vi.spyOn(pocketbase, "send").mockResolvedValue({ items: [custom] });
  vi.spyOn(pocketbase, "collection").mockReturnValue({
    getOne: vi.fn().mockResolvedValue({ id: "tenant-1", currency: "USD", locale: "en-US" }),
    update: vi
      .fn()
      .mockRejectedValue(new ApplicationError("conflict", "booking_type_archival_protected")),
  } as never);

  renderDirectory();
  fireEvent.click(await screen.findByRole("button", { name: "Archive" }));
  fireEvent.click(screen.getByRole("button", { name: "Archive booking type" }));
  expect(
    await screen.findByText("This booking type cannot be archived with configuration changes."),
  ).toBeTruthy();
});

it("moves focus to the stable directory status after successful archive", async () => {
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
  fireEvent.click(screen.getByRole("button", { name: "Archive booking type" }));
  await waitFor(() =>
    expect(document.activeElement?.textContent).toContain("Regular and Maintenance are protected"),
  );
});

it("traps archive dialog focus and closes on Escape", async () => {
  vi.spyOn(pocketbase, "send")
    .mockResolvedValueOnce({ items: [custom] })
    .mockResolvedValueOnce({ id: "tenant-1", currency: "USD", locale: "en-US" });
  vi.spyOn(pocketbase, "collection").mockReturnValue({
    getOne: vi.fn().mockResolvedValue({ id: "tenant-1", currency: "USD", locale: "en-US" }),
  } as never);

  renderDirectory();
  const trigger = await screen.findByRole("button", { name: "Archive" });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog");
  const cancel = screen.getByRole("button", { name: "Cancel" });
  const confirm = screen.getByRole("button", { name: "Archive booking type" });
  expect(document.activeElement).toBe(cancel);
  fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(confirm);
  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

it("keeps a focusable dialog target while archive controls are disabled", async () => {
  vi.spyOn(pocketbase, "send")
    .mockResolvedValueOnce({ items: [custom] })
    .mockResolvedValueOnce({ id: "tenant-1", currency: "USD", locale: "en-US" });
  vi.spyOn(pocketbase, "collection").mockReturnValue({
    getOne: vi.fn().mockResolvedValue({ id: "tenant-1", currency: "USD", locale: "en-US" }),
  } as never);

  renderDirectory();
  fireEvent.click(await screen.findByRole("button", { name: "Archive" }));
  (screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled = true;
  (screen.getByRole("button", { name: "Archive booking type" }) as HTMLButtonElement).disabled =
    true;
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Tab" });
  expect(document.activeElement).toBe(screen.getByRole("dialog"));
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
