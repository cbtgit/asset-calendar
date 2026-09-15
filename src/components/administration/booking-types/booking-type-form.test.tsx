import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { BookingTypeForm } from "./booking-type-form";

afterEach(cleanup);

describe("BookingTypeForm", () => {
  it("renders booking type and hourly price fields", () => {
    render(<BookingTypeForm onCancel={vi.fn()} />);

    expect(screen.getByLabelText("Booking type")).toBeTruthy();
    expect(screen.getByLabelText("Hourly price")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create booking type" })).toBeTruthy();
  });

  it("announces a submitted form", () => {
    render(<BookingTypeForm onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Booking type"), {
      target: { value: "Training" },
    });
    fireEvent.change(screen.getByLabelText("Hourly price"), {
      target: { value: "125" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Create booking type" }).closest("form")!);

    expect(screen.getByText("Booking type details are ready to save.")).toBeTruthy();
  });

  it("accepts comma decimal prices", () => {
    render(<BookingTypeForm onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Booking type"), {
      target: { value: "Training" },
    });
    fireEvent.change(screen.getByLabelText("Hourly price"), {
      target: { value: "12,50" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Create booking type" }).closest("form")!);

    expect(screen.getByText("Booking type details are ready to save.")).toBeTruthy();
  });
});
