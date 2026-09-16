import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { signOut } from "@/api/auth";
import type { CalendarBooking } from "@/api/bookings";
import * as bookingsApi from "@/api/bookings";
import { pocketbase } from "@/api/client";
import { bookingsKeys } from "@/api/query-keys";
import { useCreateBookingMutation } from "./use-bookings";

const booking: CalendarBooking = {
  id: "booking-1",
  resource: "resource-1",
  start: "2026-11-30T09:00:00.000Z",
  end: "2026-11-30T10:00:00.000Z",
  booker_display_name: "Regular A",
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
  queryClient.setQueryData(bookingsKeys.visible(range.resourceId, range.start, range.end), [
    booking,
  ]);
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
      bookingsKeys.visible(...(Object.values(range) as [string, string, string])),
    ),
  ).toHaveLength(2);

  rejectCreate(new Error("Conflict"));
  await expect(mutation).rejects.toThrow("Conflict");
  expect(
    queryClient.getQueryData<CalendarBooking[]>(
      bookingsKeys.visible(range.resourceId, range.start, range.end),
    ),
  ).toEqual([booking]);
});
