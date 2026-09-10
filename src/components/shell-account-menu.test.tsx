import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "@/api/client";
import { useNavigate } from "@tanstack/react-router";
import { ShellAccountMenu } from "./shell-account-menu";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: vi.fn(),
}));

afterEach(() => {
  cleanup();
  pocketbase.authStore.clear();
  vi.restoreAllMocks();
});

function renderAccountMenu(navigate = vi.fn()) {
  pocketbase.authStore.save("token", {
    id: "user-1",
    collectionId: "users",
    collectionName: "users",
    email: "person@example.test",
    first_name: "Person",
    last_name: "Example",
  });
  vi.mocked(useNavigate).mockReturnValue(navigate as never);
  return render(<ShellAccountMenu />);
}

it("shows the current user and toggles a single-action menu", () => {
  renderAccountMenu();

  const trigger = screen.getByRole("button", { name: "Person Example" });
  expect(screen.queryByRole("menu")).toBeNull();
  fireEvent.click(trigger);
  expect(screen.getByRole("menu")).toBeTruthy();
  expect(screen.getByRole("menuitem", { name: "Log out" })).toBeTruthy();
  fireEvent.click(trigger);
  expect(screen.queryByRole("menu")).toBeNull();
});

it("closes outside the menu but not on Escape", () => {
  renderAccountMenu();
  fireEvent.click(screen.getByRole("button", { name: "Person Example" }));

  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.getByRole("menu")).toBeTruthy();
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole("menu")).toBeNull();
});

it("closes when the navigation key changes", () => {
  const view = renderAccountMenu();
  fireEvent.click(screen.getByRole("button", { name: "Person Example" }));
  expect(screen.getByRole("menu")).toBeTruthy();

  view.rerender(<ShellAccountMenu key="new-location" />);
  expect(screen.queryByRole("menu")).toBeNull();
});

it("logs out and replaces history with sign-in", () => {
  const navigate = vi.fn();
  renderAccountMenu(navigate);

  fireEvent.click(screen.getByRole("button", { name: "Person Example" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Log out" }));

  expect(pocketbase.authStore.isValid).toBe(false);
  expect(navigate).toHaveBeenCalledWith({ to: "/sign-in", replace: true });
});
