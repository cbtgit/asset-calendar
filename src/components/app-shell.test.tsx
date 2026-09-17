import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "@/api/client";
import { useMatches, useNavigate, useRouterState } from "@tanstack/react-router";
import { AppShell } from "./app-shell";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    activeOptions: _activeOptions,
    activeProps,
    ...props
  }: {
    children: ReactNode;
    to: string;
    activeOptions?: unknown;
    activeProps?: Record<string, string>;
  } & Record<string, unknown>) => (
    <a href={to} {...activeProps} {...props}>
      {children}
    </a>
  ),
  Outlet: () => <p>Calendar destination</p>,
  useMatches: vi.fn(),
  useNavigate: vi.fn(),
  useRouterState: vi.fn(),
}));

afterEach(() => {
  cleanup();
  pocketbase.authStore.clear();
  vi.restoreAllMocks();
});

function mockRouterLocation(
  location: { pathname: string; href: string },
  routeIds = ["/_authenticated/calendar"],
) {
  vi.mocked(useMatches).mockReturnValue(routeIds.map((routeId) => ({ routeId })) as never);
  vi.mocked(useRouterState).mockImplementation(((options?: {
    select?: (state: unknown) => unknown;
  }) => options?.select?.({ location })) as never);
}

it("provides the shared authenticated page landmarks and outlet state", () => {
  vi.mocked(useNavigate).mockReturnValue(vi.fn() as never);
  mockRouterLocation({ pathname: "/calendar", href: "/calendar" });

  render(<AppShell />);

  expect(screen.getByRole("banner").textContent).toContain("Asset Calendar");
  expect(screen.getByRole("link", { name: "Calendar" }).getAttribute("data-active")).toBe("true");
  expect(screen.getByRole("main", { name: "Authenticated content" }).textContent).toContain(
    "Calendar destination",
  );
});

it("shows the administration module and rail for administrators", () => {
  vi.mocked(useNavigate).mockReturnValue(vi.fn() as never);
  mockRouterLocation({ pathname: "/administration/groups", href: "/administration/groups" }, [
    "/_authenticated/administration",
    "/_authenticated/administration/groups",
  ]);
  pocketbase.authStore.save("token", {
    id: "admin-1",
    collectionId: "users",
    collectionName: "users",
    email: "admin@example.test",
    role: "administrator",
  });

  render(<AppShell />);

  const administrationLink = screen.getByRole("link", { name: "Administration" });
  expect(administrationLink).toBeTruthy();
  expect(administrationLink.getAttribute("data-administrator")).toBeNull();
  expect(administrationLink.getAttribute("href")).toBe("/administration/users");
  expect(screen.getByRole("navigation", { name: "Administration navigation" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Groups" }).getAttribute("data-active")).toBe("true");
  expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
    "ACAsset Calendar",
    "Calendar",
    "Administration",
    "Users",
    "Groups",
    "Booking Types",
    "Resources",
    "Billing",
    "Settings",
  ]);
});

it("hides the administration destination from regular users", () => {
  vi.mocked(useNavigate).mockReturnValue(vi.fn() as never);
  mockRouterLocation({ pathname: "/calendar", href: "/calendar" });
  pocketbase.authStore.save("token", {
    id: "user-1",
    collectionId: "users",
    collectionName: "users",
    email: "user@example.test",
    role: "regular",
  });

  render(<AppShell />);

  expect(screen.queryByRole("link", { name: "Administration" })).toBeNull();
  expect(screen.queryByRole("navigation", { name: "Administration navigation" })).toBeNull();
});

it("logs out and replaces history with sign-in", () => {
  const navigate = vi.fn();
  const user = {
    id: "user-1",
    collectionId: "users",
    collectionName: "users",
    email: "person@example.test",
  };

  vi.mocked(useNavigate).mockReturnValue(navigate as never);
  mockRouterLocation({ pathname: "/calendar", href: "/calendar" });
  pocketbase.authStore.save("token", user);

  render(<AppShell />);
  fireEvent.click(screen.getByRole("button", { name: "person@example.test" }));
  screen.getByRole("menuitem", { name: "Log out" }).click();

  expect(pocketbase.authStore.isValid).toBe(false);
  expect(pocketbase.authStore.model).toBeNull();
  expect(pocketbase.authStore.token).toBe("");
  expect(navigate).toHaveBeenCalledWith({ to: "/sign-in", replace: true });
});

it("closes the account menu when search or hash changes on the current route", () => {
  const location = { pathname: "/calendar", href: "/calendar" };
  vi.mocked(useNavigate).mockReturnValue(vi.fn() as never);
  mockRouterLocation(location);

  const view = render(<AppShell />);
  fireEvent.click(screen.getByRole("button", { name: "Current user" }));
  expect(screen.getByRole("menu")).toBeTruthy();

  location.href = "/calendar?view=week#today";
  view.rerender(<AppShell />);

  expect(screen.queryByRole("menu")).toBeNull();
});
