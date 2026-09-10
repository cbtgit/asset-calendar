import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "@/api/client";
import { useNavigate, useRouterState } from "@tanstack/react-router";
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
  useNavigate: vi.fn(),
  useRouterState: vi.fn(),
}));

afterEach(() => {
  cleanup();
  pocketbase.authStore.clear();
  vi.restoreAllMocks();
});

it("does not expose future administration destinations from the Groups shell", () => {
  vi.mocked(useNavigate).mockReturnValue(vi.fn() as never);
  vi.mocked(useRouterState).mockImplementation(((options?: {
    select?: (state: unknown) => unknown;
  }) => options?.select?.({ location: { pathname: "/groups", href: "/groups" } })) as never);
  pocketbase.authStore.save("token", {
    id: "admin-1",
    collectionId: "users",
    collectionName: "users",
    email: "admin@example.test",
    role: "administrator",
  });

  render(<AppShell />);

  expect(screen.queryByRole("link", { name: "Billing" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Resource Registry" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Users & Roles" })).toBeNull();
  expect(screen.queryByRole("combobox", { name: /status/i })).toBeNull();
});
