import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "@/api/client";
import { routeTree } from "@/routeTree.gen";

const group = {
  id: "group-1",
  name: "Operations",
  created: "2026-01-01T00:00:00Z",
  updated: "2026-01-01T00:00:00Z",
  member_count: 0,
};

afterEach(() => {
  cleanup();
  pocketbase.authStore.clear();
  vi.restoreAllMocks();
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

async function renderGroups(initialEntries: string[]) {
  saveAdministrator();
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries }),
  });
  await router.load();
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

it("renders the directory at the groups index", async () => {
  vi.spyOn(pocketbase, "send").mockResolvedValue({
    items: [group, { ...group, id: "group-2", name: "Finance", member_count: 3 }],
  });
  await renderGroups(["/groups"]);

  expect(await screen.findByRole("heading", { name: "Groups" })).toBeTruthy();
  expect(await screen.findByText("2 groups")).toBeTruthy();
  expect(screen.getByText("Operations")).toBeTruthy();
  expect(screen.getByText("3 members")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Add Group" }).getAttribute("href")).toBe("/groups/new");
  expect(screen.queryByRole("textbox", { name: "Group name" })).toBeNull();
});

it("renders only the create form at the new group route", async () => {
  await renderGroups(["/groups/new"]);

  expect(await screen.findByRole("textbox", { name: "Group name" })).toBeTruthy();
  expect(screen.queryByText("No groups have been created yet.")).toBeNull();
  expect(screen.queryByRole("heading", { name: "Groups" })).toBeNull();
});

it("renders only the edit form for an accessible group", async () => {
  vi.spyOn(pocketbase, "send").mockResolvedValue(group);
  await renderGroups(["/groups/group-1/edit"]);

  expect(
    ((await screen.findByRole("textbox", { name: "Group name" })) as HTMLInputElement).value,
  ).toBe("Operations");
  expect(screen.queryByText("No groups have been created yet.")).toBeNull();
  expect(screen.queryByRole("heading", { name: "Groups" })).toBeNull();
});

it("renders the edit error with a link back when the group is unavailable", async () => {
  vi.spyOn(pocketbase, "send").mockRejectedValue(new Error("Missing group"));
  await renderGroups(["/groups/missing/edit"]);

  expect(await screen.findByRole("heading", { name: "Group unavailable" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Return to groups" }).getAttribute("href")).toBe(
    "/groups",
  );
});

it("replaces the history entry with groups after a successful create", async () => {
  vi.spyOn(pocketbase, "collection").mockReturnValue({
    create: vi.fn().mockResolvedValue({ id: group.id }),
  } as never);
  vi.spyOn(pocketbase, "send").mockResolvedValue(group);
  const router = await renderGroups(["/calendar", "/groups/new"]);

  fireEvent.change(await screen.findByRole("textbox", { name: "Group name" }), {
    target: { value: group.name },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create group" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/groups"));

  router.history.back();
  await waitFor(() => expect(router.state.location.pathname).toBe("/calendar"));
});

it("replaces the history entry with groups after a successful rename", async () => {
  vi.spyOn(pocketbase, "send").mockResolvedValue({ ...group, name: "Renamed" });
  const update = vi.fn().mockResolvedValue({});
  vi.spyOn(pocketbase, "collection").mockReturnValue({ update } as never);
  const router = await renderGroups(["/calendar", "/groups/group-1/edit"]);

  const input = await screen.findByRole("textbox", { name: "Group name" });
  fireEvent.change(input, { target: { value: "Renamed" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/groups"));

  router.history.back();
  await waitFor(() => expect(router.state.location.pathname).toBe("/calendar"));
});
