import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import type { BookingType } from "@/api/booking-types";
import { BookingTypeRow } from "./booking-type-row";

const mocks = vi.hoisted(() => ({
  update: { isPending: false, isError: false, error: null as Error | null, mutate: vi.fn() },
}));

vi.mock("@/hooks/use-booking-types", () => ({
  useUpdateBookingTypeMutation: () => mocks.update,
}));

const custom = {
  id: "custom-1",
  name: "After hours",
  system_kind: "custom" as const,
  surcharge_minor_units: 1250,
  billable: true,
  resource_blocking: true,
  archived: false,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderRow(type: BookingType = custom, locale = "de-DE") {
  return render(<BookingTypeRow type={type} locale={locale} currency="EUR" onArchive={vi.fn()} />);
}

it("submits localized surcharge and custom rename", async () => {
  renderRow();
  fireEvent.change(screen.getByRole("textbox", { name: "Name for After hours" }), {
    target: { value: "Evening" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "Surcharge for After hours" }), {
    target: { value: "12,50" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(mocks.update.mutate).toHaveBeenCalledWith({
      id: "custom-1",
      input: { name: "Evening", surcharge_minor_units: 1250 },
    }),
  );
});

it("submits training rename and preserves dirty edits across locale rerenders", () => {
  const training = {
    ...custom,
    id: "training-1",
    name: "Training",
    system_kind: "training" as const,
  };
  const { rerender } = renderRow(training);
  const name = screen.getByRole("textbox", { name: "Name for Training" });
  fireEvent.change(name, { target: { value: "Workshop" } });
  rerender(
    <BookingTypeRow
      type={{ ...custom, id: "training-1", name: "Training", system_kind: "training" }}
      locale="da-DK"
      currency="DKK"
      onArchive={vi.fn()}
    />,
  );
  expect(
    (screen.getByRole("textbox", { name: "Name for Training" }) as HTMLInputElement).value,
  ).toBe("Workshop");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(mocks.update.mutate).toHaveBeenCalledWith({
    id: "training-1",
    input: { name: "Workshop", surcharge_minor_units: 1250 },
  });
});

it("reconciles authoritative rollback values and displays mutation errors", () => {
  const { rerender } = renderRow();
  fireEvent.change(screen.getByRole("textbox", { name: "Name for After hours" }), {
    target: { value: "Changed" },
  });
  rerender(
    <BookingTypeRow
      type={{ ...custom, name: "Server value" }}
      locale="en-US"
      currency="USD"
      onArchive={vi.fn()}
    />,
  );
  rerender(
    <BookingTypeRow
      type={{ ...custom, name: "After hours" }}
      locale="en-US"
      currency="USD"
      onArchive={vi.fn()}
    />,
  );
  expect(
    (screen.getByRole("textbox", { name: "Name for After hours" }) as HTMLInputElement).value,
  ).toBe("After hours");
  mocks.update.isError = true;
  mocks.update.error = new Error("save failed");
  rerender(
    <BookingTypeRow
      type={{ ...custom, name: "After hours" }}
      locale="en-US"
      currency="USD"
      onArchive={vi.fn()}
    />,
  );
  expect(screen.getByRole("alert").textContent).toContain("save failed");
});
