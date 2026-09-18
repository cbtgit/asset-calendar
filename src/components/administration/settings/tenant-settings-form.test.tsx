import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vite-plus/test";
import * as tenantSettingsApi from "@/api/tenant-settings";
import { TenantSettingsForm } from "./tenant-settings-form";

const settings = {
  id: "settings-1",
  tenant: "tenant-id",
  site_title: "Asset Calendar",
  booking_lock_hours: 24,
  created: "2026-01-01T00:00:00Z",
  updated: "2026-01-01T00:00:00Z",
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <TenantSettingsForm settings={settings} />
    </QueryClientProvider>,
  );
}

it("validates the title and lock hours before saving", () => {
  const updateTenantSettings = vi.spyOn(tenantSettingsApi, "updateTenantSettings");
  renderForm();

  fireEvent.change(screen.getByLabelText("Site title"), { target: { value: " " } });
  fireEvent.change(screen.getByLabelText("Booking lock hours"), { target: { value: "1.5" } });
  fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form")!);

  expect(screen.getAllByRole("alert")).toHaveLength(1);
  expect(screen.getByText("Enter a site title.")).toBeTruthy();
  expect(updateTenantSettings).not.toHaveBeenCalled();
});

it("submits the site title and whole-hour lock setting", async () => {
  const updateTenantSettings = vi
    .spyOn(tenantSettingsApi, "updateTenantSettings")
    .mockResolvedValue({ ...settings, site_title: "Workshop", booking_lock_hours: 12 });
  renderForm();

  fireEvent.change(screen.getByLabelText("Site title"), { target: { value: "Workshop" } });
  fireEvent.change(screen.getByLabelText("Booking lock hours"), { target: { value: "12" } });
  fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form")!);

  await waitFor(() =>
    expect(updateTenantSettings).toHaveBeenCalledWith("settings-1", {
      siteTitle: "Workshop",
      bookingLockHours: 12,
    }),
  );
  expect(screen.getByText("Tenant settings saved.")).toBeTruthy();
});

it("disables both fields while saving", async () => {
  let resolveUpdate!: (value: typeof settings) => void;
  vi.spyOn(tenantSettingsApi, "updateTenantSettings").mockReturnValue(
    new Promise((resolve) => {
      resolveUpdate = resolve;
    }),
  );
  renderForm();

  fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form")!);

  await waitFor(() => expect(tenantSettingsApi.updateTenantSettings).toHaveBeenCalled());
  expect((screen.getByLabelText("Site title") as HTMLInputElement).disabled).toBe(true);
  expect((screen.getByLabelText("Booking lock hours") as HTMLInputElement).disabled).toBe(true);

  resolveUpdate(settings);
  await waitFor(() => expect(screen.getByText("Tenant settings saved.")).toBeTruthy());
});
