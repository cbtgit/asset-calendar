import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { ResourceDirectory } from "./resource-directory";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/resources">{children}</a>,
}));

const mocks = vi.hoisted(() => ({
  resources: {
    data: [
      {
        id: "resource-1",
        name: "Room",
        base_rate_minor_units: 1000,
        archived: false,
        created: "now",
        updated: "now",
      },
      {
        id: "resource-2",
        name: "Old room",
        base_rate_minor_units: 500,
        archived: true,
        created: "now",
        updated: "now",
      },
    ],
    isPending: false,
    isError: false,
    error: null as Error | null,
    refetch: vi.fn(),
  },
  settings: {
    data: { currency: "DKK", locale: "da-DK" },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  },
  archive: { isPending: false, isError: false, mutate: vi.fn() },
}));

vi.mock("@/hooks/use-resources", () => ({
  useResourcesQuery: () => mocks.resources,
  useArchiveResourceMutation: () => mocks.archive,
}));
vi.mock("@/hooks/use-tenant-settings", () => ({
  useTenantSettingsQuery: () => mocks.settings,
}));

function renderDirectory() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ResourceDirectory />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("renders loading, empty, and error states", () => {
  mocks.resources.isPending = true;
  renderDirectory();
  expect(screen.getByRole("status").textContent).toContain("Loading resources");

  mocks.resources.isPending = false;
  mocks.resources.data = [];
  renderDirectory();
  expect(screen.getByText("No resources have been created yet.")).toBeTruthy();

  mocks.resources.data = [];
  mocks.resources.isError = true;
  mocks.resources.error = new Error("network");
  renderDirectory();
  expect(screen.getByRole("alert").textContent).toContain("network");
});

it("shows administrator actions, confirms archive, and restores focus on Escape", async () => {
  mocks.resources.isError = false;
  mocks.resources.data = [
    {
      id: "resource-1",
      name: "Room",
      base_rate_minor_units: 1000,
      archived: false,
      created: "now",
      updated: "now",
    },
  ];
  renderDirectory();
  const archiveButton = screen.getByRole("button", { name: "Archive" });
  expect(screen.getByRole("link", { name: "New resource" })).toBeTruthy();
  archiveButton.focus();
  fireEvent.click(archiveButton);
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(archiveButton);

  fireEvent.click(archiveButton);
  fireEvent.click(screen.getByRole("button", { name: "Archive resource" }));
  await waitFor(() =>
    expect(mocks.archive.mutate).toHaveBeenCalledWith("resource-1", expect.anything()),
  );
});
