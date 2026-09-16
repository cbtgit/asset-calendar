import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { useNavigate } from "@tanstack/react-router";
import { useCalendarResourcesQuery } from "@/hooks/use-calendar-resources";
import { useAuth } from "@/hooks/use-auth";
import { useBookingsQuery, useDeleteBookingMutation } from "@/hooks/use-bookings";
import { CalendarSurface } from "./calendar-surface";

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
  render(<CalendarSurface search={{ date: "2026-09-16", view: "week", resource: "resource-1" }} />);

  expect(screen.getByRole("button", { name: /Studio A/ }).getAttribute("aria-pressed")).toBe(
    "true",
  );
  expect(screen.getByRole("button", { name: /Studio B/ }).getAttribute("aria-pressed")).toBe(
    "false",
  );
});
