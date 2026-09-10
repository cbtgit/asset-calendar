import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "@/api/client";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { AppShell, getActiveDestination } from "./app-shell";

vi.mock("@tanstack/react-router", () => ({
  Outlet: () => <p>Calendar destination</p>,
  useNavigate: vi.fn(),
  useRouterState: vi.fn(),
}));

afterEach(() => {
  cleanup();
  pocketbase.authStore.clear();
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
  vi.mocked(useNavigate).mockReturnValue(vi.fn() as never);
  vi.mocked(useRouterState).mockImplementation(() => "/calendar" as never);

  render(<AppShell />);

  expect(screen.getByRole("banner").textContent).toContain("Asset Calendar");
  expect(
    screen
      .getByRole("navigation", { name: "Primary navigation" })
      .getAttribute("data-active-destination"),
  ).toBe("calendar");
  expect(screen.getByRole("main").textContent).toContain("Calendar destination");
});

it("signs out and replaces history with sign-in", () => {
  const navigate = vi.fn();
  const user = {
    id: "user-1",
    collectionId: "users",
    collectionName: "users",
    email: "person@example.test",
  };

  vi.mocked(useNavigate).mockReturnValue(navigate as never);
  vi.mocked(useRouterState).mockImplementation(() => "/calendar" as never);
  pocketbase.authStore.save("token", user);

  render(<AppShell />);
  screen.getByRole("button", { name: "Sign out" }).click();

  expect(pocketbase.authStore.isValid).toBe(false);
  expect(pocketbase.authStore.model).toBeNull();
  expect(pocketbase.authStore.token).toBe("");
  expect(navigate).toHaveBeenCalledWith({ to: "/sign-in", replace: true });
});
