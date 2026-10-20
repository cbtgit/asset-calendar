import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import type { CalendarBooking } from "@/api/bookings";
import { BookingDetail } from "./booking-detail";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const booking: CalendarBooking = {
  id: "booking-1",
  resource: "resource-1",
  start: "2026-12-01T09:00:00.000Z",
  end: "2026-12-01T10:00:00.000Z",
  booker_display_name: "Regular A",
  can_edit: true,
  can_delete: true,
};

it("moves focus into the detail surface when it opens", () => {
  render(
    <BookingDetail
      booking={booking}
      isAdministrator={false}
      timeZone="America/Los_Angeles"
      onClose={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
    />,
  );

  expect(screen.getByRole("button", { name: "Close booking details" })).toBeTruthy();
  expect(screen.getByText("2026-12-01 01:00")).toBeTruthy();
  expect(screen.getByText("2026-12-01 02:00")).toBeTruthy();

  expect(document.activeElement).toBe(screen.getByRole("region", { name: "Regular A" }));
});
