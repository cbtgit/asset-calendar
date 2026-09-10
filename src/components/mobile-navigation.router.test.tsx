import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useRouterState,
} from "@tanstack/react-router";
import { afterEach, expect, it } from "vite-plus/test";
import { pocketbase } from "@/api/client";
import { ShellHeader } from "./shell-header";

const rootRoute = createRootRoute({
  component: function TestRoot() {
    const { href, pathname } = useRouterState({ select: (state) => state.location });
    return (
      <>
        <ShellHeader
          activeModule={pathname === "/groups" ? "administration" : "calendar"}
          isAdministrator
          navigationKey={href}
        />
        <Outlet />
      </>
    );
  },
});
const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  component: () => <p>Sign in</p>,
});
const calendarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/calendar",
  component: () => <p>Calendar destination</p>,
});
const groupsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/groups",
  component: () => <p>Groups destination</p>,
});
const routeTree = rootRoute.addChildren([signInRoute, calendarRoute, groupsRoute]);

afterEach(() => {
  cleanup();
  pocketbase.authStore.clear();
  window.history.replaceState(null, "", "/calendar");
});

function saveAdministrator() {
  pocketbase.authStore.save("token", {
    id: "admin-1",
    collectionId: "users",
    collectionName: "users",
    email: "admin@example.test",
    role: "administrator",
  });
}

async function renderRouter(initialEntries: string[]) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries }),
  });
  await router.load();
  render(<RouterProvider router={router} />);
  return router;
}

it("restores hamburger focus when route selection remounts the mobile navigation", async () => {
  saveAdministrator();
  const router = await renderRouter(["/calendar"]);

  fireEvent.click(await screen.findByRole("button", { name: "Open navigation" }));
  fireEvent.click(screen.getByRole("button", { name: "Administration" }));
  fireEvent.click(screen.getByRole("link", { name: "Groups" }));

  await waitFor(() => {
    expect(router.state.location.pathname).toBe("/groups");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Open navigation" }));
  });
});

it("logs out without traversing drawer history and keeps Back on sign-in", async () => {
  saveAdministrator();
  const router = await renderRouter(["/sign-in"]);
  await router.navigate({ to: "/calendar" });

  fireEvent.click(await screen.findByRole("button", { name: "Open navigation" }));
  fireEvent.click(screen.getByRole("button", { name: "Log out" }));

  await waitFor(() => {
    expect(router.state.location.pathname).toBe("/sign-in");
    expect(screen.getByText("Sign in")).toBeTruthy();
  });
  window.history.back();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(router.state.location.pathname).toBe("/sign-in");
});
