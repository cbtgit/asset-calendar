import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "@/api/client";
import { useNavigate } from "@tanstack/react-router";
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
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
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

it.each([767, 768])("renders the shell navigation at the 768px boundary (%dpx)", (width) => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });

  render(
    <MobileNavigation activeModule="calendar" isAdministrator={false} navigationKey="/calendar" />,
  );

  expect(screen.getByRole("button", { name: "Open navigation" })).toBeTruthy();
});

it("does not restore focus while initially closed or when remounted closed", () => {
  const marker = document.createElement("button");
  document.body.append(marker);
  marker.focus();

  const view = render(
    <MobileNavigation activeModule="calendar" isAdministrator={false} navigationKey="/calendar" />,
  );
  expect(document.activeElement).toBe(marker);

  view.rerender(
    <MobileNavigation
      key="new-location"
      activeModule="calendar"
      isAdministrator={false}
      navigationKey="/calendar"
    />,
  );
  expect(document.activeElement).toBe(marker);
  marker.remove();
});

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
  const backdrop = document.querySelector(".shell-mobile-backdrop");
  expect(backdrop).toBeTruthy();
  fireEvent.click(backdrop as HTMLElement);

  expect(screen.queryByRole("complementary", { name: "Mobile navigation" })).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Open navigation" }));
  expect(document.body.style.overflow).toBe("");
});

it("closes on browser Back", async () => {
  saveUser("administrator");
  render(<MobileNavigation activeModule="calendar" isAdministrator navigationKey="/calendar" />);

  openNavigation();
  window.history.back();
  await waitFor(() =>
    expect(screen.queryByRole("complementary", { name: "Mobile navigation" })).toBeNull(),
  );
});

it("closes on route selection", () => {
  saveUser("administrator");
  render(<MobileNavigation activeModule="calendar" isAdministrator navigationKey="/calendar" />);

  openNavigation();
  fireEvent.click(screen.getByRole("link", { name: "Calendar" }));
  expect(screen.queryByRole("complementary", { name: "Mobile navigation" })).toBeNull();
});

it("logs out with auth cleanup and replace navigation", () => {
  const navigate = vi.fn();
  vi.mocked(useNavigate).mockReturnValue(navigate as never);
  saveUser("regular");
  render(
    <MobileNavigation activeModule="calendar" isAdministrator={false} navigationKey="/calendar" />,
  );

  openNavigation();
  fireEvent.click(screen.getByRole("button", { name: "Log out" }));

  expect(pocketbase.authStore.isValid).toBe(false);
  expect(navigate).toHaveBeenCalledWith({ to: "/sign-in", replace: true });
});
