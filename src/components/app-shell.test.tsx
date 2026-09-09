import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "@/api/client";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "@tanstack/react-router";
import { AppShell } from "./app-shell";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: vi.fn(),
}));

vi.mock("./health-status", () => ({
  HealthStatus: () => <div>Connected</div>,
}));

afterEach(() => {
  cleanup();
  pocketbase.authStore.clear();
  vi.restoreAllMocks();
});

it("signs out and navigates to sign-in", () => {
  const navigate = vi.fn();
  const user = {
    id: "user-1",
    collectionId: "users",
    collectionName: "users",
    email: "person@example.test",
  };

  vi.mocked(useAuth).mockReturnValue({
    status: "authenticated",
    user,
  });
  vi.mocked(useNavigate).mockReturnValue(navigate as never);
  pocketbase.authStore.save("token", user);

  render(<AppShell />);
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

  expect(pocketbase.authStore.isValid).toBe(false);
  expect(pocketbase.authStore.model).toBeNull();
  expect(pocketbase.authStore.token).toBe("");
  expect(navigate).toHaveBeenCalledWith({ to: "/sign-in", replace: true });
});

it.each(["loading", "unauthenticated", "unavailable"] as const)(
  "does not render protected content while auth is %s",
  (status) => {
    vi.mocked(useAuth).mockReturnValue({ status, user: null });

    render(<AppShell />);

    expect(screen.queryByRole("main")).toBeNull();
    expect(screen.queryByText("Keep important date in view.")).toBeNull();
  },
);
