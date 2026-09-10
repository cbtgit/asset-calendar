import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "@/api/client";
import { GroupForm } from "./group-form";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderForm(
  props: Parameters<typeof GroupForm>[0] = {
    mode: "create",
    onCancel: vi.fn(),
    onSuccess: vi.fn(),
  },
) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <GroupForm {...props} />
    </QueryClientProvider>,
  );
}

it("focuses the name field and returns focus after validation failure", () => {
  renderForm();
  const input = screen.getByRole("textbox", { name: "Group name" });
  expect(document.activeElement).toBe(input);

  fireEvent.submit(screen.getByRole("button", { name: "Create group" }).closest("form")!);

  expect(screen.getByRole("alert").textContent).toBe("Enter a group name.");
  expect(document.activeElement).toBe(input);
});

it("preserves the entered name and maps a conflict to the field", async () => {
  const conflict = Object.assign(new Error("Duplicate"), { status: 409 });
  vi.spyOn(pocketbase, "collection").mockReturnValue({
    create: vi.fn().mockRejectedValue(conflict),
  } as never);
  renderForm();
  const input = screen.getByRole("textbox", { name: "Group name" });
  fireEvent.change(input, { target: { value: "Operations" } });
  fireEvent.submit(screen.getByRole("button", { name: "Create group" }).closest("form")!);

  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("already exists"));
  expect((input as HTMLInputElement).value).toBe("Operations");
  expect(input.getAttribute("aria-invalid")).toBe("true");
});

it("disables the form while the mutation is pending and calls cancel", async () => {
  let resolveCreate!: (value: { id: string }) => void;
  vi.spyOn(pocketbase, "collection").mockReturnValue({
    create: vi.fn().mockReturnValue(new Promise((resolve) => (resolveCreate = resolve))),
  } as never);
  vi.spyOn(pocketbase, "send").mockResolvedValue({
    id: "group-1",
    name: "Operations",
    created: "2026-01-01T00:00:00Z",
    updated: "2026-01-01T00:00:00Z",
    member_count: 0,
  });
  const onCancel = vi.fn();
  renderForm({ mode: "create", onCancel, onSuccess: vi.fn() });
  const input = screen.getByRole("textbox", { name: "Group name" });
  fireEvent.change(input, { target: { value: "Operations" } });
  fireEvent.submit(screen.getByRole("button", { name: "Create group" }).closest("form")!);

  await waitFor(() => expect((input as HTMLInputElement).disabled).toBe(true));
  expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(true);
  resolveCreate({ id: "group-1" });
  await waitFor(() => expect((input as HTMLInputElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onCancel).toHaveBeenCalledOnce();
});
