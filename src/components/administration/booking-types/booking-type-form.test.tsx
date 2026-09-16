import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import * as bookingTypesApi from "@/api/booking-types";
import { ApplicationError } from "@/api/errors";
import { BookingTypeForm } from "./booking-type-form";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

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
          nonbillable: false,
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

  it("rejects a whitespace-only booking type name and focuses the field", () => {
    const createBookingType = vi.spyOn(bookingTypesApi, "createBookingType");
    renderForm();

    const nameInput = screen.getByLabelText("Booking type");
    fireEvent.change(nameInput, { target: { value: "   " } });
    fireEvent.change(screen.getByLabelText("Hourly price"), { target: { value: "125" } });
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form")!);

    expect(screen.getByRole("alert").textContent).toBe("Enter a booking type name.");
    expect(nameInput.getAttribute("aria-invalid")).toBe("true");
    expect(nameInput.getAttribute("aria-describedby")).toBe("booking-type-name-error");
    expect(document.activeElement).toBe(nameInput);
    expect(createBookingType).not.toHaveBeenCalled();
  });

  it("maps duplicate normalized names to a booking type conflict", async () => {
    const duplicate = new ApplicationError("validation", "Value must be unique.", {
      response: {
        data: {
          name_normalized: { code: "validation_not_unique" },
        },
      },
    });
    vi.spyOn(bookingTypesApi, "createBookingType").mockRejectedValue(duplicate);
    renderForm();

    fireEvent.change(screen.getByLabelText("Booking type"), {
      target: { value: "Training" },
    });
    fireEvent.change(screen.getByLabelText("Hourly price"), { target: { value: "125" } });
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form")!);

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("already exists"));
    expect(screen.getByLabelText("Booking type").getAttribute("aria-invalid")).toBe("true");
  });

  it("hides raw messages for generic save failures", async () => {
    vi.spyOn(bookingTypesApi, "createBookingType").mockRejectedValue(
      new ApplicationError("server", "internal database details"),
    );
    renderForm();

    fireEvent.change(screen.getByLabelText("Booking type"), {
      target: { value: "Training" },
    });
    fireEvent.change(screen.getByLabelText("Hourly price"), { target: { value: "125" } });
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form")!);

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "We could not save this booking type. Try again.",
      ),
    );
    expect(screen.queryByText("internal database details")).toBeNull();
  });

  it("loads and saves an existing booking type", async () => {
    const updateBookingType = vi
      .spyOn(bookingTypesApi, "updateBookingType")
      .mockResolvedValue({} as never);
    renderEditForm();

    expect(screen.getByRole("heading", { name: "Edit Booking Type" })).toBeTruthy();
    expect((screen.getByLabelText("Booking type") as HTMLInputElement).value).toBe("Operations");
    expect((screen.getByLabelText("Hourly price") as HTMLInputElement).value).toBe("12,50");

    fireEvent.change(screen.getByLabelText("Booking type"), {
      target: { value: "Updated operations" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form")!);

    await waitFor(() =>
      expect(updateBookingType).toHaveBeenCalledWith("booking-type-1", {
        name: "Updated operations",
        surchargeMinorUnits: 1250,
        nonbillable: false,
      }),
    );
  });

  it("submits non-billable booking types without a surcharge", async () => {
    const createBookingType = vi
      .spyOn(bookingTypesApi, "createBookingType")
      .mockResolvedValue({} as never);
    renderForm();

    fireEvent.change(screen.getByLabelText("Booking type"), {
      target: { value: "Maintenance" },
    });
    fireEvent.change(screen.getByLabelText("Hourly price"), {
      target: { value: "125" },
    });
    fireEvent.click(screen.getByLabelText("Non-billable booking type"));

    expect(screen.getByLabelText("Hourly price")).toHaveProperty("disabled", true);
    expect((screen.getByLabelText("Hourly price") as HTMLInputElement).value).toBe("");
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form")!);

    await waitFor(() => expect(createBookingType).toHaveBeenCalled());
    expect(createBookingType.mock.calls[0][0]).toEqual({
      name: "Maintenance",
      surchargeMinorUnits: 0,
      nonbillable: true,
    });
  });
});
