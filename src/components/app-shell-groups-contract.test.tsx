import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "@/api/client";
import { useMatches, useNavigate, useRouterState } from "@tanstack/react-router";
import { AppShell } from "./app-shell";

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
  Outlet: () => <p>Groups destination</p>,
  useMatches: vi.fn(),
  useNavigate: vi.fn(),
  useRouterState: vi.fn(),
}));

afterEach(() => {
  cleanup();
  pocketbase.authStore.clear();
  vi.restoreAllMocks();
});

it("exposes the current administration destinations from the Groups shell", () => {
  vi.mocked(useNavigate).mockReturnValue(vi.fn() as never);
  vi.mocked(useMatches).mockReturnValue([
    { routeId: "/_authenticated/administration" },
    { routeId: "/_authenticated/administration/groups" },
  ] as never);
  vi.mocked(useRouterState).mockImplementation(((options?: {
    select?: (state: unknown) => unknown;
  }) =>
    options?.select?.({
      location: { pathname: "/administration/groups", href: "/administration/groups" },
    })) as never);
  pocketbase.authStore.save("token", {
    id: "admin-1",
    collectionId: "users",
    collectionName: "users",
    email: "admin@example.test",
    role: "administrator",
  });

  render(<AppShell />);

  expect(screen.getByRole("link", { name: "Groups" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Booking Types" })).toBeTruthy();
  expect(screen.queryByRole("combobox", { name: /status/i })).toBeNull();
});
