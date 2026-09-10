import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { useRouterState } from "@tanstack/react-router";
import { AppShell, getActiveDestination } from "./app-shell";

vi.mock("@tanstack/react-router", () => ({
  Outlet: () => <p>Calendar destination</p>,
  useRouterState: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it.each([
  ["/calendar", "calendar"],
  ["/groups", "groups"],
  ["/groups/new", "groups"],
] as const)("derives the active destination from %s", (pathname, destination) => {
  expect(getActiveDestination(pathname)).toBe(destination);
});

it("provides the shared authenticated page landmarks and outlet state", () => {
  vi.mocked(useRouterState).mockReturnValue("calendar" as never);

  render(<AppShell />);

  expect(screen.getByRole("banner").textContent).toContain("Asset Calendar");
  expect(
    screen
      .getByRole("navigation", { name: "Primary navigation" })
      .getAttribute("data-active-destination"),
  ).toBe("calendar");
  expect(screen.getByRole("main").textContent).toContain("Calendar destination");
});
