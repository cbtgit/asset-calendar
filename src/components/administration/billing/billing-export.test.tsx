import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { downloadBillingCsv, searchBilling } from "@/api/billing";
import { BillingExport } from "./billing-export";

vi.mock("@/api/billing", () => ({
  downloadBillingCsv: vi.fn(),
  searchBilling: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

it("searches and renders records grouped with group and grand amount totals", async () => {
  vi.mocked(searchBilling).mockResolvedValue({
    start: "2026-09-01",
    end: "2026-10-01",
    groups: [
      {
        name: "Operations",
        total: "125.50",
        records: [
          {
            start: "2026-09-03T07:00:00.000Z",
            end: "2026-09-03T09:00:00.000Z",
            duration_hours: "2",
            booker: "Ada Lovelace",
            group: "Operations",
            resource: "Room A",
            booking_type: "Training",
            amount: "125.50",
          },
        ],
      },
      { name: "Finance", total: "50.00", records: [] },
    ],
    total: "175.50",
  });

  render(<BillingExport />);
  fireEvent.change(screen.getByLabelText("Start"), { target: { value: "2026-09-01" } });
  fireEvent.change(screen.getByLabelText("End"), { target: { value: "2026-10-01" } });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));

  await waitFor(() => expect(screen.getByText("Ada Lovelace")).toBeTruthy());
  expect(screen.getByRole("heading", { name: "Operations" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Finance" })).toBeTruthy();
  expect(screen.getAllByText("125,50 kr.")).toHaveLength(2);
  expect(screen.getByText("50,00 kr.")).toBeTruthy();
  expect(screen.getByText("175,50 kr.")).toBeTruthy();
  expect(searchBilling).toHaveBeenCalledWith({
    start: "2026-09-01",
    end: "2026-10-01",
  });
});

it("announces invalid intervals without calling the server", () => {
  render(<BillingExport />);
  fireEvent.click(screen.getByRole("button", { name: "Search" }));

  expect(screen.getByRole("alert").textContent).toContain("Select both");
  expect(searchBilling).not.toHaveBeenCalled();
});

it("keeps CSV download separate from Search", async () => {
  vi.mocked(searchBilling).mockResolvedValue({
    start: "2026-09-01T00:00",
    end: "2026-10-01T00:00",
    groups: [{ name: "Operations", total: "10.00", records: [] }],
    total: "10.00",
  });
  vi.mocked(downloadBillingCsv).mockResolvedValue(new Blob(["csv"]));
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

  render(<BillingExport />);
  fireEvent.change(screen.getByLabelText("Start"), { target: { value: "2026-09-01" } });
  fireEvent.change(screen.getByLabelText("End"), { target: { value: "2026-10-01" } });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Download CSV" })).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "Download CSV" }));

  await waitFor(() =>
    expect(downloadBillingCsv).toHaveBeenCalledWith({
      start: "2026-09-01",
      end: "2026-10-01",
    }),
  );
  expect(searchBilling).toHaveBeenCalledTimes(1);
});
