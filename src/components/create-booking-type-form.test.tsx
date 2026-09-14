import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { CreateBookingTypeForm } from "./create-booking-type-form";

const mocks = vi.hoisted(() => ({
  mutation: { isPending: false, isError: false, error: null as Error | null, mutate: vi.fn() },
}));
vi.mock("@/hooks/use-booking-types", () => ({
  useCreateBookingTypeMutation: () => mocks.mutation,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.mutation.isError = false;
  mocks.mutation.error = null;
});

it("parses localized surcharge and resets after success", () => {
  render(<CreateBookingTypeForm locale="de-DE" />);
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Evening" } });
  fireEvent.change(screen.getByLabelText("Surcharge"), { target: { value: "12,50" } });
  fireEvent.click(screen.getByRole("button", { name: "Add booking type" }));
  const options = mocks.mutation.mutate.mock.calls[0][1];
  expect(mocks.mutation.mutate).toHaveBeenCalledWith(
    { name: "Evening", surcharge_minor_units: 1250, system_kind: "custom" },
    expect.any(Object),
  );
  void act(() => options.onSuccess());
  expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("Surcharge") as HTMLInputElement).value).toBe("0,00");
});

it("validates blank and invalid input and displays mutation failures", () => {
  render(<CreateBookingTypeForm locale="en-US" />);
  fireEvent.change(screen.getByLabelText("Surcharge"), { target: { value: "not money" } });
  fireEvent.submit(screen.getByRole("button", { name: "Add booking type" }).closest("form")!);
  expect(screen.getByRole("alert").textContent).toContain("Enter a name");
  expect(mocks.mutation.mutate).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Custom" } });
  fireEvent.change(screen.getByLabelText("Surcharge"), { target: { value: "1.234,567" } });
  fireEvent.click(screen.getByRole("button", { name: "Add booking type" }));
  expect(mocks.mutation.mutate).not.toHaveBeenCalled();
  mocks.mutation.isError = true;
  mocks.mutation.error = new Error("server rejected");
  fireEvent.change(screen.getByLabelText("Surcharge"), { target: { value: "1.23" } });
  expect(screen.getByRole("alert").textContent).toContain("server rejected");
});
