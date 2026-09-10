import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "@/api/client";
import { MobileNavigation } from "./mobile-navigation";

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
  useNavigate: vi.fn(),
}));

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
  window.history.replaceState(null, "", "/calendar");
  pocketbase.authStore.clear();
  vi.restoreAllMocks();
});

function saveUser(role: "administrator" | "regular") {
  pocketbase.authStore.save("token", {
    id: "user-1",
    collectionId: "users",
    collectionName: "users",
    email: "person@example.test",
    role,
  });
}

function openNavigation() {
  fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
  return screen.getByRole("complementary", { name: "Mobile navigation" });
}

it("opens the drawer, moves focus into it, locks scrolling, and keeps Escape inert", () => {
  saveUser("regular");
  render(
    <MobileNavigation activeModule="calendar" isAdministrator={false} navigationKey="/calendar" />,
  );

  openNavigation();

  expect(document.activeElement).toBe(
    screen.getByRole("complementary", { name: "Mobile navigation" }),
  );
  expect(document.body.style.overflow).toBe("hidden");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.getByRole("complementary", { name: "Mobile navigation" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Administration" })).toBeNull();
});

it("shows administrator destinations and closes on outside tap with focus restoration", () => {
  saveUser("administrator");
  render(<MobileNavigation activeModule="calendar" isAdministrator navigationKey="/calendar" />);

  openNavigation();
  fireEvent.click(screen.getByRole("button", { name: "Administration" }));

  expect(screen.getByRole("link", { name: "Groups" })).toBeTruthy();
  fireEvent.click(
    within(screen.getByRole("complementary", { name: "Mobile navigation" })).getByRole("button", {
      name: "Close navigation",
    }),
  );

  expect(screen.queryByRole("complementary", { name: "Mobile navigation" })).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Open navigation" }));
  expect(document.body.style.overflow).toBe("");
});

it("closes on browser Back and route selection", () => {
  saveUser("administrator");
  render(<MobileNavigation activeModule="calendar" isAdministrator navigationKey="/calendar" />);

  openNavigation();
  fireEvent.popState(window);
  expect(screen.queryByRole("complementary", { name: "Mobile navigation" })).toBeNull();

  openNavigation();
  fireEvent.click(screen.getByRole("link", { name: "Calendar" }));
  expect(screen.queryByRole("complementary", { name: "Mobile navigation" })).toBeNull();
});
