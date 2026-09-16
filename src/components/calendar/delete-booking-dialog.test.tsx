import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import type { CalendarBooking } from "@/api/bookings";
import { DeleteBookingDialog } from "./delete-booking-dialog";

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
};

function DialogHarness() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open delete confirmation
      </button>
      {isOpen ? (
        <DeleteBookingDialog
          booking={booking}
          pending={false}
          onCancel={() => setIsOpen(false)}
          onConfirm={vi.fn()}
        />
      ) : null}
    </>
  );
}

it("moves focus into the dialog, traps Tab, and restores focus on cancel", () => {
  render(<DialogHarness />);

  const trigger = screen.getByRole("button", { name: "Open delete confirmation" });
  trigger.focus();
  fireEvent.click(trigger);

  const dialog = screen.getByRole("dialog", { name: "Delete this booking?" });
  const cancel = screen.getByRole("button", { name: "Cancel" });
  const confirm = screen.getByRole("button", { name: "Delete booking" });
  expect(document.activeElement).toBe(cancel);

  fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(confirm);

  fireEvent.keyDown(dialog, { key: "Tab" });
  expect(document.activeElement).toBe(cancel);

  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: "Delete this booking?" })).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

it("disables both confirmation actions while deletion is pending", () => {
  render(<DeleteBookingDialog booking={booking} pending onCancel={vi.fn()} onConfirm={vi.fn()} />);

  expect(screen.getByRole("button", { name: "Cancel" })).toHaveProperty("disabled", true);
  expect(screen.getByRole("button", { name: "Deleting..." })).toHaveProperty("disabled", true);
});
