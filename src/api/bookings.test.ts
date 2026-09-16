import { afterEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "./client";
import {
  createBooking,
  deleteBooking,
  getBooking,
  getCalendarBookings,
  updateBooking,
} from "./bookings";

afterEach(() => vi.restoreAllMocks());

const range = {
  resourceId: "resource-1",
  start: "2026-11-30T08:00:00.000Z",
  end: "2026-11-30T14:00:00.000Z",
};

it("loads visible bookings through the safe calendar endpoint", async () => {
  const send = vi.spyOn(pocketbase, "send").mockResolvedValue({ items: [] } as never);

  await expect(getCalendarBookings(range)).resolves.toEqual([]);
  expect(send).toHaveBeenCalledWith(
    "/api/calendar/bookings?resource=resource-1&start=2026-11-30T08%3A00%3A00.000Z&end=2026-11-30T14%3A00%3A00.000Z",
    { method: "GET" },
  );
});

it("creates a booking through the protected calendar endpoint", async () => {
  const booking = {
    id: "booking-1",
    resource: "resource-1",
    start: range.start,
    end: range.end,
    booker_display_name: "Regular A",
  };
  const send = vi.spyOn(pocketbase, "send").mockResolvedValue(booking as never);

  await expect(
    createBooking({ resource: "resource-1", start: range.start, end: range.end }),
  ).resolves.toEqual(booking);
  expect(send).toHaveBeenCalledWith("/api/calendar/bookings", {
    method: "POST",
    body: { resource: "resource-1", start: range.start, end: range.end },
  });
});

it("loads a booking detail through the protected calendar endpoint", async () => {
  const booking = { id: "booking-1", resource: "resource-1" };
  const send = vi.spyOn(pocketbase, "send").mockResolvedValue(booking as never);

  await expect(getBooking(booking.id)).resolves.toEqual(booking);
  expect(send).toHaveBeenCalledWith("/api/calendar/bookings/booking-1", { method: "GET" });
});

it("updates permitted booking fields through the protected calendar endpoint", async () => {
  const booking = { id: "booking-1", resource: "resource-1" };
  const send = vi.spyOn(pocketbase, "send").mockResolvedValue(booking as never);

  await expect(
    updateBooking({
      id: booking.id,
      start: range.start,
      end: range.end,
      booked_for_user: "user-1",
      booking_type: null,
    }),
  ).resolves.toEqual(booking);
  expect(send).toHaveBeenCalledWith("/api/calendar/bookings/booking-1", {
    method: "PATCH",
    body: {
      start: range.start,
      end: range.end,
      booked_for_user: "user-1",
      booking_type: null,
    },
  });
});

it("deletes a booking through the protected calendar endpoint", async () => {
  const response = { id: "booking-1" };
  const send = vi.spyOn(pocketbase, "send").mockResolvedValue(response as never);

  await expect(deleteBooking(response.id)).resolves.toEqual(response);
  expect(send).toHaveBeenCalledWith("/api/calendar/bookings/booking-1", {
    method: "DELETE",
  });
});
