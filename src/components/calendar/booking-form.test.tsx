import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { ApplicationError } from "@/api/errors";
import * as authHook from "@/hooks/use-auth";
import * as bookingsHook from "@/hooks/use-bookings";
import * as tenantSettingsHook from "@/hooks/use-tenant-settings";
import { usersKeys } from "@/api/query-keys";
import { bookingTypesKeys } from "@/api/query-keys";
import { BookingForm } from "./booking-form";
import { formatApplicationDate } from "@/lib/time";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderForm(
  isAdministrator: boolean,
  initialBooking?: Parameters<typeof BookingForm>[0]["initialBooking"],
  bookingReleasePolicy?: Parameters<typeof BookingForm>[0]["bookingReleasePolicy"],
  initialDate = "2026-11-30",
) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  queryClient.setQueryData(usersKeys.active(), [
    {
      id: "user-2",
      display_name: "Regular A",
      email: "regular@example.test",
      role: "regular",
      booking_access: "",
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
        bookingReleasePolicy={bookingReleasePolicy}
        initialStart={initialBooking?.start}
        initialEnd={initialBooking?.end}
        initialBooking={initialBooking}
        initialDate={initialDate}
        onCancel={vi.fn()}
        onSuccess={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

it("keeps administrator-only selectors out of the regular form", () => {
  vi.spyOn(bookingsHook, "useCreateBookingMutation").mockReturnValue({
    mutateAsync: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    error: null,
  } as never);
  renderForm(false);

  expect(screen.getByRole("button", { name: "Close booking form" })).toBeTruthy();
  expect(screen.getByLabelText("Start hour").tagName).toBe("SELECT");
  expect(screen.getByLabelText("End hour").tagName).toBe("SELECT");
  expect(
    Array.from((screen.getByLabelText("Start hour") as HTMLSelectElement).options)
      .map((option) => option.value)
      .filter(Boolean),
  ).toEqual(Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0")));
  expect(
    Array.from((screen.getByLabelText("Start minute") as HTMLSelectElement).options)
      .map((option) => option.value)
      .filter(Boolean),
  ).toEqual(["00", "15", "30", "45"]);
  expect(
    Array.from((screen.getByLabelText("End minute") as HTMLSelectElement).options)
      .map((option) => option.value)
      .filter(Boolean),
  ).toEqual(["00", "15", "30", "45"]);
  expect(screen.queryByLabelText("User")).toBeNull();
  expect(screen.queryByLabelText("Booking type")).toBeNull();
});

it("shows regular users when a restricted booking week opens and disables saving", () => {
  vi.spyOn(bookingsHook, "useCreateBookingMutation").mockReturnValue({
    mutateAsync: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    error: null,
  } as never);
  const futureDate = formatApplicationDate(new Date(Date.now() + 28 * 24 * 60 * 60 * 1000));
  renderForm(
    false,
    undefined,
    {
      priority_booking_enabled: true,
      public_booking_release_weekday: 3,
      public_booking_release_time: "10:00",
    },
    futureDate,
  );

  expect(screen.getByRole("status").textContent).toContain("This week opens to everyone");
  expect(screen.getByRole("status").textContent).not.toContain("Priority booking is open now");
  expect(screen.getByRole("button", { name: "Save" })).toHaveProperty("disabled", true);
});

it("does not show a release warning when a restricted booking interval is unchanged", () => {
  const start = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  vi.spyOn(bookingsHook, "useUpdateBookingMutation").mockReturnValue({
    mutateAsync: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    error: null,
  } as never);
  renderForm(
    false,
    {
      id: "booking-unchanged",
      resource: "resource-1",
      start: start.toISOString(),
      end: end.toISOString(),
      booker_display_name: "Regular A",
      can_edit: true,
      can_delete: true,
    },
    {
      priority_booking_enabled: true,
      public_booking_release_weekday: 3,
      public_booking_release_time: "10:00",
    },
  );

  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.getByRole("button", { name: "Save changes" })).toHaveProperty("disabled", false);
});

it("shows the destination release and blocks a changed edit into a closed week", () => {
  const sourceStart = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const sourceEnd = new Date(sourceStart.getTime() + 60 * 60 * 1000);
  const closedDate = formatApplicationDate(new Date(Date.now() + 28 * 24 * 60 * 60 * 1000));
  vi.spyOn(bookingsHook, "useUpdateBookingMutation").mockReturnValue({
    mutateAsync: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    error: null,
  } as never);
  renderForm(
    false,
    {
      id: "booking-closed-destination",
      resource: "resource-1",
      start: sourceStart.toISOString(),
      end: sourceEnd.toISOString(),
      booker_display_name: "Regular A",
      can_edit: true,
      can_delete: true,
    },
    {
      priority_booking_enabled: true,
      public_booking_release_weekday: 3,
      public_booking_release_time: "10:00",
    },
  );

  fireEvent.change(screen.getByLabelText("Start date"), { target: { value: closedDate } });
  fireEvent.change(screen.getByLabelText("End date"), { target: { value: closedDate } });

  expect(screen.getByRole("status").textContent).toContain("cannot be moved into that week");
  expect(screen.getByRole("button", { name: "Save changes" })).toHaveProperty("disabled", true);
});

it("allows a changed edit into an open week when both starts clear the lock", () => {
  const sourceStart = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const sourceEnd = new Date(sourceStart.getTime() + 60 * 60 * 1000);
  const destinationDate = formatApplicationDate(new Date(Date.now() + 4 * 24 * 60 * 60 * 1000));
  vi.spyOn(bookingsHook, "useUpdateBookingMutation").mockReturnValue({
    mutateAsync: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    error: null,
  } as never);
  renderForm(
    false,
    {
      id: "booking-open-destination",
      resource: "resource-1",
      start: sourceStart.toISOString(),
      end: sourceEnd.toISOString(),
      booker_display_name: "Regular A",
      can_edit: true,
      can_delete: true,
    },
    {
      priority_booking_enabled: true,
      public_booking_release_weekday: 3,
      public_booking_release_time: "10:00",
    },
  );

  fireEvent.change(screen.getByLabelText("Start date"), { target: { value: destinationDate } });
  fireEvent.change(screen.getByLabelText("End date"), { target: { value: destinationDate } });

  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByRole("button", { name: "Save changes" })).toHaveProperty("disabled", false);
});

it("renders a current-start-locked edit as read-only", () => {
  const start = new Date(Date.now() + 12 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  renderForm(false, {
    id: "booking-current-lock",
    resource: "resource-1",
    start: start.toISOString(),
    end: end.toISOString(),
    booker_display_name: "Regular A",
    can_edit: true,
    can_delete: true,
  });

  expect(screen.getByRole("alert").textContent).toContain("current start is within the 24 hour");
  expect(screen.getByLabelText("Start date")).toHaveProperty("disabled", true);
  expect(screen.getByRole("button", { name: "Save changes" })).toHaveProperty("disabled", true);
});

it("keeps the edit lock for priority users while bypassing only release", () => {
  vi.spyOn(authHook, "useAuth").mockReturnValue({
    user: { booking_access: ["priority"] },
  } as never);
  const sourceStart = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const sourceEnd = new Date(sourceStart.getTime() + 60 * 60 * 1000);
  const lockedStart = new Date(Date.now() + 12 * 60 * 60 * 1000);
  const lockedDate = formatApplicationDate(lockedStart);
  renderForm(
    false,
    {
      id: "booking-priority-lock",
      resource: "resource-1",
      start: sourceStart.toISOString(),
      end: sourceEnd.toISOString(),
      booker_display_name: "Regular A",
      can_edit: true,
      can_delete: true,
    },
    {
      priority_booking_enabled: true,
      public_booking_release_weekday: 3,
      public_booking_release_time: "10:00",
    },
  );

  expect(screen.queryByRole("status")).toBeNull();
  fireEvent.change(screen.getByLabelText("Start date"), { target: { value: lockedDate } });

  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.getByRole("alert").textContent).toContain("new start must be at least 24 hours");
  expect(screen.getByRole("button", { name: "Save changes" })).toHaveProperty("disabled", true);
});

it("allows priority access when PocketBase returns the entitlement as an array", () => {
  vi.spyOn(bookingsHook, "useCreateBookingMutation").mockReturnValue({
    mutateAsync: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    error: null,
  } as never);
  vi.spyOn(authHook, "useAuth").mockReturnValue({
    user: { booking_access: ["priority"] },
  } as never);
  const futureDate = formatApplicationDate(new Date(Date.now() + 28 * 24 * 60 * 60 * 1000));
  renderForm(
    false,
    undefined,
    {
      priority_booking_enabled: true,
      public_booking_release_weekday: 3,
      public_booking_release_time: "10:00",
    },
    futureDate,
  );

  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.getByRole("button", { name: "Save" })).toHaveProperty("disabled", false);
});

it("updates untouched booking times when the tenant timezone loads", async () => {
  const settingsQuery = vi
    .spyOn(tenantSettingsHook, "useTenantSettingsQuery")
    .mockReturnValue({ data: undefined } as never);
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const props = {
    resourceId: "resource-1",
    resourceName: "Room A",
    isAdministrator: false,
    initialStart: "2026-11-30T18:00:00.000Z",
    initialEnd: "2026-11-30T19:00:00.000Z",
    onCancel: vi.fn(),
    onSuccess: vi.fn(),
  };
  const view = render(<BookingForm {...props} />, { wrapper });

  expect((screen.getByLabelText("Start hour") as HTMLSelectElement).value).toBe("19");
  expect((screen.getByLabelText("Start minute") as HTMLSelectElement).value).toBe("00");
  settingsQuery.mockReturnValue({ data: { time_zone: "America/Los_Angeles" } } as never);
  view.rerender(<BookingForm {...props} />);

  await waitFor(() =>
    expect((screen.getByLabelText("Start hour") as HTMLSelectElement).value).toBe("10"),
  );
  fireEvent.change(screen.getByLabelText("Start hour"), { target: { value: "12" } });
  settingsQuery.mockReturnValue({ data: { time_zone: "America/New_York" } } as never);
  view.rerender(<BookingForm {...props} />);

  expect((screen.getByLabelText("Start hour") as HTMLSelectElement).value).toBe("12");
  expect((screen.getByLabelText("Start minute") as HTMLSelectElement).value).toBe("00");
});

it("submits administrator-selected user and booking type", async () => {
  const mutateAsync = vi.fn().mockResolvedValue({});
  vi.spyOn(bookingsHook, "useCreateBookingMutation").mockReturnValue({
    mutateAsync,
    reset: vi.fn(),
    isPending: false,
    error: null,
  } as never);
  renderForm(true);

  fireEvent.change(screen.getByLabelText("Start hour"), { target: { value: "09" } });
  fireEvent.change(screen.getByLabelText("Start minute"), { target: { value: "00" } });
  fireEvent.change(screen.getByLabelText("End hour"), { target: { value: "10" } });
  fireEvent.change(screen.getByLabelText("End minute"), { target: { value: "00" } });
  fireEvent.change(screen.getByLabelText("User"), { target: { value: "user-2" } });
  fireEvent.change(screen.getByLabelText("Booking type"), { target: { value: "type-1" } });
  fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form")!);

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
    reset: vi.fn(),
    isPending: false,
    error: new ApplicationError("validation", "Booking_resource_conflict."),
  } as never);
  renderForm(false);

  fireEvent.change(screen.getByLabelText("Start hour"), { target: { value: "09" } });
  fireEvent.change(screen.getByLabelText("Start minute"), { target: { value: "00" } });
  fireEvent.change(screen.getByLabelText("End hour"), { target: { value: "10" } });
  fireEvent.change(screen.getByLabelText("End minute"), { target: { value: "00" } });
  fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form")!);

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
    reset: vi.fn(),
    isPending: false,
    error: null,
  } as never);
  vi.spyOn(bookingsHook, "useUpdateBookingMutation").mockReturnValue({
    mutateAsync,
    reset: vi.fn(),
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

  fireEvent.change(screen.getByLabelText("Start hour"), { target: { value: "10" } });
  fireEvent.change(screen.getByLabelText("Start minute"), { target: { value: "15" } });
  fireEvent.change(screen.getByLabelText("End hour"), { target: { value: "11" } });
  fireEvent.change(screen.getByLabelText("End minute"), { target: { value: "45" } });
  fireEvent.submit(screen.getByRole("button", { name: "Save changes" }).closest("form")!);

  await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
  expect(mutateAsync.mock.calls[0][0]).toMatchObject({
    id: "booking-1",
    start: "2026-11-30T09:15:00.000Z",
    end: "2026-11-30T10:45:00.000Z",
    booked_for_user: "user-2",
    booking_type: "type-1",
  });
});

it("preserves an ambiguous autumn DST slot when the edit fields are unchanged", async () => {
  const mutateAsync = vi.fn().mockResolvedValue({});
  vi.spyOn(bookingsHook, "useCreateBookingMutation").mockReturnValue({
    mutateAsync: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    error: null,
  } as never);
  vi.spyOn(bookingsHook, "useUpdateBookingMutation").mockReturnValue({
    mutateAsync,
    reset: vi.fn(),
    isPending: false,
    error: null,
  } as never);
  renderForm(false, {
    id: "booking-fold",
    resource: "resource-1",
    start: "2027-10-31T00:30:00.000Z",
    end: "2027-10-31T01:30:00.000Z",
    booker_display_name: "Regular A",
    can_edit: true,
    can_delete: true,
  });

  fireEvent.submit(screen.getByRole("button", { name: "Save changes" }).closest("form")!);

  await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
  expect(mutateAsync.mock.calls[0][0]).toMatchObject({
    id: "booking-fold",
    start: "2027-10-31T00:30:00.000Z",
    end: "2027-10-31T01:30:00.000Z",
  });
});
