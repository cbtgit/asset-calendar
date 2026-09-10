import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "@/api/client";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { AppShell, getActiveDestination, getActiveModule } from "./app-shell";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    ...props
  }: { children: ReactNode; to: string } & Record<string, unknown>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
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

it.each([
  ["/calendar", "calendar"],
  ["/groups", "administration"],
  ["/groups/new", "administration"],
] as const)("derives the active module from %s", (pathname, module) => {
  expect(getActiveModule(pathname)).toBe(module);
});

it("provides the shared authenticated page landmarks and outlet state", () => {
  vi.mocked(useNavigate).mockReturnValue(vi.fn() as never);
  vi.mocked(useRouterState).mockImplementation(() => "/calendar" as never);

  render(<AppShell />);

  expect(screen.getByRole("banner").textContent).toContain("Asset Calendar");
  expect(screen.getByRole("link", { name: "Calendar" }).getAttribute("data-active")).toBe("true");
  expect(screen.getByRole("main", { name: "Authenticated content" }).textContent).toContain(
    "Calendar destination",
  );
});

it("shows the administration module and rail for administrators", () => {
  vi.mocked(useNavigate).mockReturnValue(vi.fn() as never);
  vi.mocked(useRouterState).mockImplementation(() => "/groups" as never);
  pocketbase.authStore.save("token", {
    id: "admin-1",
    collectionId: "users",
    collectionName: "users",
    email: "admin@example.test",
    role: "administrator",
  });

  render(<AppShell />);

  expect(screen.getByRole("link", { name: "Administration" })).toBeTruthy();
  expect(screen.getByRole("navigation", { name: "Administration navigation" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Groups" }).getAttribute("data-active")).toBe("true");
});

it("hides the administration destination from regular users", () => {
  vi.mocked(useNavigate).mockReturnValue(vi.fn() as never);
  vi.mocked(useRouterState).mockImplementation(() => "/calendar" as never);
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
  vi.mocked(useRouterState).mockImplementation(() => "/calendar" as never);
  pocketbase.authStore.save("token", user);

  render(<AppShell />);
  fireEvent.click(screen.getByRole("button", { name: "person@example.test" }));
  screen.getByRole("menuitem", { name: "Log out" }).click();

  expect(pocketbase.authStore.isValid).toBe(false);
  expect(pocketbase.authStore.model).toBeNull();
  expect(pocketbase.authStore.token).toBe("");
  expect(navigate).toHaveBeenCalledWith({ to: "/sign-in", replace: true });
});
