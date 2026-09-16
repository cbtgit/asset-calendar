import { afterEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "./client";
import { createBooking, getCalendarBookings } from "./bookings";

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
