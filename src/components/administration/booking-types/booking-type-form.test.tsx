import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import * as bookingTypesApi from "@/api/booking-types";
import { BookingTypeForm } from "./booking-type-form";

afterEach(cleanup);

function renderForm(onSuccess?: () => void) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <BookingTypeForm onCancel={vi.fn()} onSuccess={onSuccess} />
    </QueryClientProvider>,
  );
}

function renderEditForm() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <BookingTypeForm
        mode="edit"
        initialBookingType={{
          id: "booking-type-1",
          tenant: "tenant-id",
          name: "Operations",
          name_normalized: "operations",
          surcharge_minor_units: 1250,
          archived_at: "",
          created: "2026-01-01T00:00:00Z",
          updated: "2026-01-01T00:00:00Z",
        }}
        onCancel={vi.fn()}
        onSuccess={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

describe("BookingTypeForm", () => {
  it("renders booking type and hourly price fields", () => {
    renderForm();

    expect(screen.getByLabelText("Booking type")).toBeTruthy();
    expect(screen.getByLabelText("Hourly price")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
  });

  it("announces a submitted form", async () => {
    vi.spyOn(bookingTypesApi, "createBookingType").mockResolvedValue({} as never);
    renderForm();

    fireEvent.change(screen.getByLabelText("Booking type"), {
      target: { value: "Training" },
    });
    fireEvent.change(screen.getByLabelText("Hourly price"), {
      target: { value: "125" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form")!);

    await waitFor(() =>
      expect(screen.getByText("Booking type details are ready to save.")).toBeTruthy(),
    );
  });

  it("calls onSuccess after creating a booking type", async () => {
    const onSuccess = vi.fn();
    vi.spyOn(bookingTypesApi, "createBookingType").mockResolvedValue({} as never);
    renderForm(onSuccess);

    fireEvent.change(screen.getByLabelText("Booking type"), {
      target: { value: "Training" },
    });
    fireEvent.change(screen.getByLabelText("Hourly price"), {
      target: { value: "125" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form")!);

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
  });

  it("accepts comma decimal prices", async () => {
    vi.spyOn(bookingTypesApi, "createBookingType").mockResolvedValue({} as never);
    renderForm();

    fireEvent.change(screen.getByLabelText("Booking type"), {
      target: { value: "Training" },
    });
    fireEvent.change(screen.getByLabelText("Hourly price"), {
      target: { value: "12,50" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form")!);

    await waitFor(() =>
      expect(screen.getByText("Booking type details are ready to save.")).toBeTruthy(),
    );
  });

  it("loads and saves an existing booking type", async () => {
    const updateBookingType = vi
      .spyOn(bookingTypesApi, "updateBookingType")
      .mockResolvedValue({} as never);
    renderEditForm();

    expect(screen.getByRole("heading", { name: "Edit Booking Type" })).toBeTruthy();
    expect((screen.getByLabelText("Booking type") as HTMLInputElement).value).toBe("Operations");
    expect((screen.getByLabelText("Hourly price") as HTMLInputElement).value).toBe("12.5");

    fireEvent.change(screen.getByLabelText("Booking type"), {
      target: { value: "Updated operations" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form")!);

    await waitFor(() =>
      expect(updateBookingType).toHaveBeenCalledWith("booking-type-1", {
        name: "Updated operations",
        surchargeMinorUnits: 1250,
      }),
    );
  });
});
