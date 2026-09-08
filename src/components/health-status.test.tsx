import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "@/api/client";
import { HealthStatus } from "./health-status";

function renderHealthStatus() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <HealthStatus />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("shows the checking and connected states", async () => {
  vi.spyOn(pocketbase.health, "check").mockResolvedValue({
    code: 200,
    message: "API is healthy.",
    data: {},
  });

  renderHealthStatus();

  expect(screen.getByText("Checking PocketBase connection…")).toBeTruthy();
  await waitFor(() => expect(screen.getByText("Connected")).toBeTruthy());
});

it("shows a failure and retries the health request", async () => {
  const check = vi
    .spyOn(pocketbase.health, "check")
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ code: 200, message: "API is healthy.", data: {} });

  renderHealthStatus();

  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("offline"));
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));

  await waitFor(() => expect(screen.getByText("Connected")).toBeTruthy());
  expect(check).toHaveBeenCalledTimes(2);
});
