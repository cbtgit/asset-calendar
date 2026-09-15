import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "@/api/client";
import { routeTree } from "@/routeTree.gen";

const user = {
  id: "user-1",
  first_name: "Ada",
  last_name: "Lovelace",
  display_name: "Ada Lovelace",
  email: "ada@example.test",
  group: "group-1",
  role: "regular" as const,
  active: true,
  password_setup_pending: true,
  created: "2026-01-01T00:00:00Z",
  updated: "2026-01-01T00:00:00Z",
};

afterEach(() => {
  cleanup();
  pocketbase.authStore.clear();
  vi.restoreAllMocks();
});

async function renderUsers(path: string) {
  pocketbase.authStore.save("token", {
    id: "admin-1",
    collectionId: "users",
    collectionName: "users",
    email: "admin@example.test",
    role: "administrator",
  });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
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

it("renders a scannable user directory", async () => {
  vi.spyOn(pocketbase, "send").mockResolvedValue({ items: [user] });
  await renderUsers("/administration/users");

  expect(await screen.findByRole("heading", { name: "Users" })).toBeTruthy();
  expect(await screen.findByText("Ada Lovelace")).toBeTruthy();
  expect(screen.getByText("Invitation pending")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Edit Ada Lovelace" }).getAttribute("href")).toBe(
    "/administration/users/user-1/edit",
  );
});

it("renders the editor with labeled controls and immutable email on edit", async () => {
  vi.spyOn(pocketbase, "send").mockImplementation(async (path) => {
    if (path === "/api/groups") return { items: [{ id: "group-1", name: "Operations" }] };
    return user;
  });
  await renderUsers("/administration/users/user-1/edit");

  expect(await screen.findByRole("heading", { name: "Edit user" })).toBeTruthy();
  expect(screen.getByRole("textbox", { name: "Email" })).toHaveProperty("disabled", true);
  expect(screen.getByRole("combobox", { name: "Group" })).toBeTruthy();
  expect(screen.getByRole("combobox", { name: "Role" })).toBeTruthy();
  expect(screen.getByRole("checkbox", { name: "Active user" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Resend invitation" })).toBeTruthy();
});

it("shows a specific validation message when the email is already in use", async () => {
  vi.spyOn(pocketbase, "send").mockImplementation(async (path, options) => {
    if (path === "/api/groups") return { items: [{ id: "group-1", name: "Operations" }] };
    if (path === "/api/users" && options?.method === "POST") {
      throw Object.assign(new Error("Email_already_exists."), { status: 400 });
    }
    return { items: [] };
  });
  await renderUsers("/administration/users/new");

  fireEvent.change(await screen.findByRole("textbox", { name: "First name" }), {
    target: { value: "Grace" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "Last name" }), {
    target: { value: "Hopper" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "Email" }), {
    target: { value: "grace@example.test" },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "Group" }), {
    target: { value: "group-1" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create user" }));

  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe("A user with this email already exists."),
  );
});
