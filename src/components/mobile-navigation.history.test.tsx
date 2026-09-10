import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  createBrowserHistory,
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
const routeTree = rootRoute.addChildren([calendarRoute, groupsRoute]);

afterEach(() => {
  cleanup();
  pocketbase.authStore.clear();
  window.history.replaceState(null, "", "/sign-in");
});

it("keeps the selected route after the drawer closes without traversing history", async () => {
  pocketbase.authStore.save("token", {
    id: "admin-1",
    collectionId: "users",
    collectionName: "users",
    email: "admin@example.test",
    role: "administrator",
  });
  window.history.replaceState(null, "", "/calendar");
  const router = createRouter({ routeTree, history: createBrowserHistory() });
  await router.load();
  render(<RouterProvider router={router} />);

  fireEvent.click(await screen.findByRole("button", { name: "Open navigation" }));
  fireEvent.click(screen.getByRole("button", { name: "Administration" }));
  fireEvent.click(screen.getByRole("link", { name: "Groups" }));

  await waitFor(() => {
    expect(router.state.location.pathname).toBe("/groups");
    expect(window.location.pathname).toBe("/groups");
  });
  await new Promise((resolve) => window.setTimeout(resolve, 10));

  expect(router.state.location.pathname).toBe("/groups");
  expect(window.location.pathname).toBe("/groups");
});
