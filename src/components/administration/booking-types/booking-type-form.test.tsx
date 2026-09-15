import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import * as bookingTypesApi from "@/api/booking-types";
import { BookingTypeForm } from "./booking-type-form";

afterEach(cleanup);

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <BookingTypeForm onCancel={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe("BookingTypeForm", () => {
  it("renders booking type and hourly price fields", () => {
    renderForm();

    expect(screen.getByLabelText("Booking type")).toBeTruthy();
    expect(screen.getByLabelText("Hourly price")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create booking type" })).toBeTruthy();
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
    fireEvent.submit(screen.getByRole("button", { name: "Create booking type" }).closest("form")!);

    await waitFor(() =>
      expect(screen.getByText("Booking type details are ready to save.")).toBeTruthy(),
    );
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
    fireEvent.submit(screen.getByRole("button", { name: "Create booking type" }).closest("form")!);

    await waitFor(() =>
      expect(screen.getByText("Booking type details are ready to save.")).toBeTruthy(),
    );
  });
});
