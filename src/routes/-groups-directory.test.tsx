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

async function renderGroups() {
  saveAdministrator();
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/groups"] }),
  });
  await router.load();
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

it("requires confirmation before deleting an eligible group", async () => {
  vi.spyOn(pocketbase, "send").mockResolvedValue({ items: [group] });
  const remove = vi.fn().mockResolvedValue(true);
  vi.spyOn(pocketbase, "collection").mockReturnValue({ delete: remove } as never);
  await renderGroups();

  fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
  expect(remove).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete group" }));
  await waitFor(() => expect(remove).toHaveBeenCalledWith("group-1"));
});

it("keeps delete visible but disabled for groups with members", async () => {
  vi.spyOn(pocketbase, "send").mockResolvedValue({ items: [{ ...group, member_count: 2 }] });
  await renderGroups();

  const deleteButton = await screen.findByRole("button", { name: "Delete" });
  expect((deleteButton as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText("Delete unavailable: 2 members assigned")).toBeTruthy();
});

it("renders an empty state", async () => {
  vi.spyOn(pocketbase, "send").mockResolvedValue({ items: [] });
  await renderGroups();

  expect(await screen.findByText("No groups have been created yet.")).toBeTruthy();
});

it("can retry a failed groups request", async () => {
  const send = vi
    .spyOn(pocketbase, "send")
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ items: [group] });
  await renderGroups();

  expect((await screen.findByRole("alert")).textContent).toContain("offline");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("Operations")).toBeTruthy();
  expect(send).toHaveBeenCalledTimes(2);
});
