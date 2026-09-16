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

function renderForm(
  isAdministrator: boolean,
  initialBooking?: Parameters<typeof BookingForm>[0]["initialBooking"],
) {
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
      nonbillable: false,
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
        initialStart={initialBooking?.start}
        initialEnd={initialBooking?.end}
        initialBooking={initialBooking}
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

  expect(screen.getByRole("button", { name: "Close booking form" })).toBeTruthy();
  expect(screen.getByLabelText("Start time").getAttribute("step")).toBe("900");
  expect(screen.getByLabelText("End time").getAttribute("step")).toBe("900");
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
    optimisticBookerDisplayName: "Regular A",
    optimisticBookingTypeName: "Training",
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

it("initializes and submits administrator edit fields", async () => {
  const mutateAsync = vi.fn().mockResolvedValue({});
  vi.spyOn(bookingsHook, "useCreateBookingMutation").mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  } as never);
  vi.spyOn(bookingsHook, "useUpdateBookingMutation").mockReturnValue({
    mutateAsync,
    isPending: false,
    error: null,
  } as never);
  renderForm(true, {
    id: "booking-1",
    resource: "resource-1",
    start: "2026-11-30T08:00:00.000Z",
    end: "2026-11-30T09:00:00.000Z",
    booker_display_name: "Regular A",
    booking_type: "type-1",
    booking_type_name: "Training",
    booked_for_user: "user-2",
    can_edit: true,
    can_delete: true,
  });

  expect(screen.getByText("Edit booking")).toBeTruthy();
  expect(screen.getByLabelText("User")).toHaveProperty("value", "user-2");
  expect(screen.getByLabelText("Booking type")).toHaveProperty("value", "type-1");

  fireEvent.change(screen.getByLabelText("Start time"), { target: { value: "10:00" } });
  fireEvent.change(screen.getByLabelText("End time"), { target: { value: "11:00" } });
  fireEvent.submit(screen.getByRole("button", { name: "Save changes" }).closest("form")!);

  await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
  expect(mutateAsync.mock.calls[0][0]).toMatchObject({
    id: "booking-1",
    start: "2026-11-30T09:00:00.000Z",
    end: "2026-11-30T10:00:00.000Z",
    booked_for_user: "user-2",
    booking_type: "type-1",
  });
});

it("preserves an ambiguous autumn DST slot when the edit fields are unchanged", async () => {
  const mutateAsync = vi.fn().mockResolvedValue({});
  vi.spyOn(bookingsHook, "useCreateBookingMutation").mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  } as never);
  vi.spyOn(bookingsHook, "useUpdateBookingMutation").mockReturnValue({
    mutateAsync,
    isPending: false,
    error: null,
  } as never);
  renderForm(false, {
    id: "booking-fold",
    resource: "resource-1",
    start: "2026-10-25T00:30:00.000Z",
    end: "2026-10-25T01:30:00.000Z",
    booker_display_name: "Regular A",
    can_edit: true,
    can_delete: true,
  });

  fireEvent.submit(screen.getByRole("button", { name: "Save changes" }).closest("form")!);

  await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
  expect(mutateAsync.mock.calls[0][0]).toMatchObject({
    id: "booking-fold",
    start: "2026-10-25T00:30:00.000Z",
    end: "2026-10-25T01:30:00.000Z",
  });
});
