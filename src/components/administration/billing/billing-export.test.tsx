import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { downloadBillingCsv, searchBilling, type BillingPreview } from "@/api/billing";
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

it("renders billing totals per user and shows optional account references", async () => {
  vi.mocked(searchBilling).mockResolvedValue({
    start: "2026-09-01",
    end: "2026-10-01",
    users: [
      {
        name: "Ada Lovelace",
        email: "ada@example.test",
        total: "125.50",
        records: [
          {
            start: "2026-09-03T07:00:00.000Z",
            end: "2026-09-03T09:00:00.000Z",
            duration_hours: "2",
            booker: "Ada Lovelace",
            booker_email: "ada@example.test",
            account_reference_number: "AC-42",
            resource: "Room A",
            booking_type: "Training",
            amount: "125.50",
          },
        ],
      },
      {
        name: "Grace Hopper",
        email: "grace@example.test",
        total: "50.00",
        records: [
          {
            start: "2026-09-04T07:00:00.000Z",
            end: "2026-09-04T08:00:00.000Z",
            duration_hours: "1",
            booker: "Grace Hopper",
            booker_email: "grace@example.test",
            account_reference_number: "AC-42",
            resource: "Room B",
            booking_type: "",
            amount: "50.00",
          },
        ],
      },
    ],
    total: "175.50",
  });

  render(<BillingExport />);
  fireEvent.change(screen.getByLabelText("Start"), { target: { value: "2026-09-01" } });
  fireEvent.change(screen.getByLabelText("End"), { target: { value: "2026-10-01" } });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));

  await waitFor(() => expect(screen.getByRole("heading", { name: "Ada Lovelace" })).toBeTruthy());
  expect(screen.getByRole("heading", { name: "Ada Lovelace" })).toBeTruthy();
  expect(screen.getByText("ada@example.test")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Grace Hopper" })).toBeTruthy();
  expect(screen.getByText("grace@example.test")).toBeTruthy();
  expect(screen.getAllByText("Account/reference: AC-42")).toHaveLength(2);
  expect(screen.getAllByText("125,50 kr.")).toHaveLength(2);
  expect(screen.getAllByText("50,00 kr.")).toHaveLength(2);
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

it("disables date fields while a search is pending", async () => {
  let resolveSearch!: (preview: BillingPreview) => void;
  vi.mocked(searchBilling).mockReturnValue(
    new Promise((resolve) => {
      resolveSearch = resolve;
    }),
  );

  render(<BillingExport />);
  const start = screen.getByLabelText("Start");
  const end = screen.getByLabelText("End");
  fireEvent.change(start, { target: { value: "2026-09-01" } });
  fireEvent.change(end, { target: { value: "2026-10-01" } });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));

  await waitFor(() => {
    expect(start).toHaveProperty("disabled", true);
    expect(end).toHaveProperty("disabled", true);
  });

  resolveSearch({ start: "2026-09-01", end: "2026-10-01", users: [], total: "0.00" });
  await waitFor(() => {
    expect(start).toHaveProperty("disabled", false);
    expect(end).toHaveProperty("disabled", false);
  });
});

it("keeps CSV download separate from Search", async () => {
  vi.mocked(searchBilling).mockResolvedValue({
    start: "2026-09-01T00:00",
    end: "2026-10-01T00:00",
    users: [{ name: "Ada Lovelace", email: "ada@example.test", total: "10.00", records: [] }],
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
