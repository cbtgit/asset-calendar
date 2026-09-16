import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { ApplicationError } from "@/api/errors";
import * as bookingsHook from "@/hooks/use-bookings";
import { usersKeys } from "@/api/query-keys";
import { bookingTypesKeys } from "@/api/query-keys";
import { BookingForm } from "./booking-form";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderForm(isAdministrator: boolean) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  queryClient.setQueryData(usersKeys.active(), [
    {
      id: "user-2",
      display_name: "Regular A",
      email: "regular@example.test",
      group: "group-1",
      role: "regular",
    },
  ]);
  queryClient.setQueryData(bookingTypesKeys.list(), [
    {
      id: "type-1",
      name: "Training",
      name_normalized: "training",
      surcharge_minor_units: 100,
      archived_at: "",
      tenant: "tenant-1",
      created: "",
      updated: "",
    },
  ]);
  return render(
    <QueryClientProvider client={queryClient}>
      <BookingForm
        resourceId="resource-1"
        resourceName="Room A"
        isAdministrator={isAdministrator}
        initialDate="2026-11-30"
        onCancel={vi.fn()}
        onSuccess={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

it("keeps administrator-only selectors out of the regular form", () => {
  vi.spyOn(bookingsHook, "useCreateBookingMutation").mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  } as never);
  renderForm(false);

  expect(screen.queryByLabelText("User")).toBeNull();
  expect(screen.queryByLabelText("Booking type")).toBeNull();
});

it("submits administrator-selected user and booking type", async () => {
  const mutateAsync = vi.fn().mockResolvedValue({});
  vi.spyOn(bookingsHook, "useCreateBookingMutation").mockReturnValue({
    mutateAsync,
    isPending: false,
    error: null,
  } as never);
  renderForm(true);

  fireEvent.change(screen.getByLabelText("Start time"), { target: { value: "09:00" } });
  fireEvent.change(screen.getByLabelText("End time"), { target: { value: "10:00" } });
  fireEvent.change(screen.getByLabelText("User"), { target: { value: "user-2" } });
  fireEvent.change(screen.getByLabelText("Booking type"), { target: { value: "type-1" } });
  fireEvent.submit(screen.getByRole("button", { name: "Create booking" }).closest("form")!);

  await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
  expect(mutateAsync.mock.calls[0][0]).toMatchObject({
    resource: "resource-1",
    booked_for_user: "user-2",
    booking_type: "type-1",
    start: "2026-11-30T08:00:00.000Z",
    end: "2026-11-30T09:00:00.000Z",
  });
});

it("shows a descriptive message for a booking conflict", async () => {
  const mutateAsync = vi
    .fn()
    .mockRejectedValue(new ApplicationError("validation", "Booking_resource_conflict."));
  vi.spyOn(bookingsHook, "useCreateBookingMutation").mockReturnValue({
    mutateAsync,
    isPending: false,
    error: new ApplicationError("validation", "Booking_resource_conflict."),
  } as never);
  renderForm(false);

  fireEvent.change(screen.getByLabelText("Start time"), { target: { value: "09:00" } });
  fireEvent.change(screen.getByLabelText("End time"), { target: { value: "10:00" } });
  fireEvent.submit(screen.getByRole("button", { name: "Create booking" }).closest("form")!);

  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe(
      "This resource is already booked during that time. Choose a different time.",
    ),
  );
});
