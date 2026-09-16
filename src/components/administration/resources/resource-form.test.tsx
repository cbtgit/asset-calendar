import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vite-plus/test";
import * as resourcesApi from "@/api/resources";
import { ApplicationError } from "@/api/errors";
import { ResourceForm } from "./resource-form";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ResourceForm
        mode="edit"
        initialResource={{
          id: "resource-1",
          tenant: "tenant-id",
          name: "Operations",
          name_normalized: "operations",
          base_rate_minor_units: 1250,
          archived_at: "2026-01-01 00:00:00.000Z",
          created: "2026-01-01T00:00:00Z",
          updated: "2026-01-01T00:00:00Z",
        }}
        onCancel={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

it("initializes Danish hourly-price input and submits integer minor units", async () => {
  const updateResource = vi.spyOn(resourcesApi, "updateResource").mockResolvedValue({} as never);
  renderForm();

  expect((screen.getByLabelText("Hourly price") as HTMLInputElement).value).toBe("12,50");
  fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form")!);

  await waitFor(() =>
    expect(updateResource).toHaveBeenCalledWith("resource-1", {
      name: "Operations",
      baseRateMinorUnits: 1250,
    }),
  );
});

it("rejects ambiguous dot-decimal input under the Danish policy", () => {
  const createResource = vi.spyOn(resourcesApi, "createResource");
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ResourceForm onCancel={vi.fn()} />
    </QueryClientProvider>,
  );

  fireEvent.change(screen.getByLabelText("Resource"), { target: { value: "Room A" } });
  fireEvent.change(screen.getByLabelText("Hourly price"), { target: { value: "12.50" } });
  fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form")!);

  expect(screen.getByRole("alert").textContent).toContain("1.234,50");
  expect(createResource).not.toHaveBeenCalled();
});

it("shows the conflict message for a nested PocketBase uniqueness response", async () => {
  vi.spyOn(resourcesApi, "createResource").mockRejectedValue(
    new ApplicationError(
      "validation",
      "Failed to create record.",
      Object.assign(new Error("Failed to create record."), {
        status: 400,
        data: {},
        response: {
          data: {
            name_normalized: { code: "validation_not_unique" },
          },
        },
      }),
    ),
  );
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ResourceForm onCancel={vi.fn()} />
    </QueryClientProvider>,
  );

  fireEvent.change(screen.getByLabelText("Resource"), { target: { value: "Room A" } });
  fireEvent.change(screen.getByLabelText("Hourly price"), { target: { value: "12,50" } });
  fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form")!);

  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("already exists"));
  expect(screen.queryByText("We could not save this resource. Try again.")).toBeNull();
});
