import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { signOut } from "@/api/auth";
import type { CalendarBooking } from "@/api/bookings";
import * as bookingsApi from "@/api/bookings";
import { pocketbase } from "@/api/client";
import { bookingsKeys } from "@/api/query-keys";
import {
  useCreateBookingMutation,
  useDeleteBookingMutation,
  useUpdateBookingMutation,
} from "./use-bookings";

const booking: CalendarBooking = {
  id: "booking-1",
  resource: "resource-1",
  start: "2026-11-30T09:00:00.000Z",
  end: "2026-11-30T10:00:00.000Z",
  booker_display_name: "Regular A",
  booking_type_color: "#168C6C",
};

const range = {
  resourceId: "resource-1",
  start: "2026-11-30T08:00:00.000Z",
  end: "2026-11-30T14:00:00.000Z",
};

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  queryClient.setQueryData(
    bookingsKeys.visible(
      "tenant-id",
      "user-1",
      "regular",
      range.resourceId,
      range.start,
      range.end,
    ),
    [booking],
  );
  return { queryClient, wrapper };
}

beforeEach(() => {
  signOut();
  pocketbase.authStore.save("token", {
    id: "user-1",
    collectionId: "users",
    collectionName: "users",
    email: "regular@example.test",
    first_name: "Regular",
    last_name: "A",
    role: "regular",
    tenant: "tenant-id",
  });
});

afterEach(() => {
  signOut();
  vi.restoreAllMocks();
});

it("optimistically adds a booking and rolls it back on failure", async () => {
  let rejectCreate!: (reason: unknown) => void;
  vi.spyOn(bookingsApi, "createBooking").mockReturnValue(
    new Promise<CalendarBooking>((_resolve, reject) => {
      rejectCreate = reject;
    }),
  );
  const { queryClient, wrapper } = setup();
  const { result } = renderHook(() => useCreateBookingMutation(), { wrapper });

  let mutation!: Promise<unknown>;
  await act(async () => {
    mutation = result.current.mutateAsync({
      resource: "resource-1",
      start: "2026-11-30T10:00:00.000Z",
      end: "2026-11-30T11:00:00.000Z",
    });
    await Promise.resolve();
  });
  expect(
    queryClient.getQueryData<CalendarBooking[]>(
      bookingsKeys.visible(
        "tenant-id",
        "user-1",
        "regular",
        ...(Object.values(range) as [string, string, string]),
      ),
    ),
  ).toHaveLength(2);

  rejectCreate(new Error("Conflict"));
  await expect(mutation).rejects.toThrow("Conflict");
  expect(
    queryClient.getQueryData<CalendarBooking[]>(
      bookingsKeys.visible(
        "tenant-id",
        "user-1",
        "regular",
        range.resourceId,
        range.start,
        range.end,
      ),
    ),
  ).toEqual([booking]);
});

it("optimistically removes a booking when an update leaves the visible range", async () => {
  let resolveUpdate!: (value: CalendarBooking) => void;
  vi.spyOn(bookingsApi, "updateBooking").mockReturnValue(
    new Promise<CalendarBooking>((resolve) => {
      resolveUpdate = resolve;
    }),
  );
  const { queryClient, wrapper } = setup();
  const { result } = renderHook(() => useUpdateBookingMutation(), { wrapper });

  let mutation!: Promise<unknown>;
  await act(async () => {
    mutation = result.current.mutateAsync({
      id: booking.id,
      start: "2026-12-01T09:00:00.000Z",
      end: "2026-12-01T10:00:00.000Z",
      optimisticBooking: booking,
    });
    await Promise.resolve();
  });

  expect(
    queryClient.getQueryData(
      bookingsKeys.visible(
        "tenant-id",
        "user-1",
        "regular",
        ...(Object.values(range) as [string, string, string]),
      ),
    ),
  ).toEqual([]);
  resolveUpdate({ ...booking, start: "2026-12-01T09:00:00.000Z", end: "2026-12-01T10:00:00.000Z" });
  await mutation;
});

it("preserves the current booking type color when no optimistic booking is provided", async () => {
  let resolveUpdate!: (value: CalendarBooking) => void;
  vi.spyOn(bookingsApi, "updateBooking").mockReturnValue(
    new Promise<CalendarBooking>((resolve) => {
      resolveUpdate = resolve;
    }),
  );
  const { queryClient, wrapper } = setup();
  const { result } = renderHook(() => useUpdateBookingMutation(), { wrapper });

  let mutation!: Promise<unknown>;
  await act(async () => {
    mutation = result.current.mutateAsync({
      id: booking.id,
      start: booking.start,
      end: booking.end,
      booking_type: "booking-type-1",
    });
    await Promise.resolve();
  });

  expect(
    queryClient.getQueryData<CalendarBooking[]>(
      bookingsKeys.visible(
        "tenant-id",
        "user-1",
        "regular",
        range.resourceId,
        range.start,
        range.end,
      ),
    ),
  ).toEqual([
    expect.objectContaining({
      booking_type: "booking-type-1",
      booking_type_color: "#168C6C",
    }),
  ]);

  resolveUpdate({ ...booking, booking_type: "booking-type-1" });
  await mutation;
});

it("optimistically deletes a booking and restores it on failure", async () => {
  let rejectDelete!: (reason: unknown) => void;
  vi.spyOn(bookingsApi, "deleteBooking").mockReturnValue(
    new Promise<{ id: string }>((_resolve, reject) => {
      rejectDelete = reject;
    }),
  );
  const { queryClient, wrapper } = setup();
  const { result } = renderHook(() => useDeleteBookingMutation(), { wrapper });

  let mutation!: Promise<unknown>;
  await act(async () => {
    mutation = result.current.mutateAsync({ id: booking.id });
    await Promise.resolve();
  });
  expect(
    queryClient.getQueryData(
      bookingsKeys.visible(
        "tenant-id",
        "user-1",
        "regular",
        ...(Object.values(range) as [string, string, string]),
      ),
    ),
  ).toEqual([]);

  rejectDelete(new Error("Delete failed"));
  await expect(mutation).rejects.toThrow("Delete failed");
  expect(
    queryClient.getQueryData(
      bookingsKeys.visible(
        "tenant-id",
        "user-1",
        "regular",
        ...(Object.values(range) as [string, string, string]),
      ),
    ),
  ).toEqual([booking]);
});
