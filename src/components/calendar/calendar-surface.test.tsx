import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { useNavigate } from "@tanstack/react-router";
import { useCalendarResourcesQuery } from "@/hooks/use-calendar-resources";
import { useAuth } from "@/hooks/use-auth";
import { useBookingsQuery, useDeleteBookingMutation } from "@/hooks/use-bookings";
import { CalendarSurface } from "./calendar-surface";
import { toCalendarEvents } from "./calendar-events";

vi.mock("@tanstack/react-router", () => ({ useNavigate: vi.fn() }));
vi.mock("@/hooks/use-calendar-resources", () => ({ useCalendarResourcesQuery: vi.fn() }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/use-bookings", () => ({
  useBookingsQuery: vi.fn(),
  useDeleteBookingMutation: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.mocked(useNavigate).mockReturnValue(vi.fn() as never);
  vi.mocked(useAuth).mockReturnValue({
    status: "authenticated",
    user: { role: "regular" },
  } as never);
  vi.mocked(useBookingsQuery).mockReturnValue({
    data: [],
    isPending: false,
    isError: false,
  } as never);
  vi.mocked(useDeleteBookingMutation).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  } as never);
  vi.mocked(useCalendarResourcesQuery).mockReturnValue({
    data: [
      { id: "resource-1", name: "Studio A" },
      { id: "resource-2", name: "Studio B" },
    ],
    isPending: false,
    isError: false,
  } as never);
});

it("exposes the selected desktop resource through aria-pressed", () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CalendarSurface search={{ date: "2026-09-16", view: "week", resource: "resource-1" }} />
    </QueryClientProvider>,
  );

  expect(screen.getByRole("button", { name: /Studio A/ }).getAttribute("aria-pressed")).toBe(
    "true",
  );
  expect(screen.getByRole("button", { name: /Studio B/ }).getAttribute("aria-pressed")).toBe(
    "false",
  );
});

it("uses booking type snapshots for event labels and colors", () => {
  const [typed, untyped, legacyTyped] = toCalendarEvents([
    {
      id: "booking-1",
      resource: "resource-1",
      start: "2026-09-16T08:00:00.000Z",
      end: "2026-09-16T09:00:00.000Z",
      booker_display_name: "Regular A",
      booking_type_name: "Training",
      booking_type_color: "#168C6C",
    },
    {
      id: "booking-2",
      resource: "resource-1",
      start: "2026-09-16T09:00:00.000Z",
      end: "2026-09-16T10:00:00.000Z",
      booker_display_name: "Regular B",
      booking_type_name: null,
      booking_type_color: null,
    },
    {
      id: "booking-3",
      resource: "resource-1",
      start: "2026-09-16T10:00:00.000Z",
      end: "2026-09-16T11:00:00.000Z",
      booker_display_name: "Regular C",
      booking_type_name: "Legacy",
      booking_type_color: null,
    },
  ]);

  expect(typed.title).toBe("Training - Regular A");
  expect(typed.backgroundColor).toBe("#168C6C");
  expect(typed.borderColor).toBe("#168C6C");
  expect(untyped.title).toBe("Regular B");
  expect(untyped.backgroundColor).toBeUndefined();
  expect(legacyTyped.title).toBe("Legacy - Regular C");
  expect(legacyTyped.backgroundColor).toBeUndefined();
});
