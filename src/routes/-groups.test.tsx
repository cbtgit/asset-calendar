import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "@/api/client";
import { Route as GroupsRoute } from "./_authenticated/groups";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Outlet: () => <div data-testid="groups-outlet" />,
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("renders the Groups placeholder without loading or mutating group data", () => {
  const collection = vi.spyOn(pocketbase, "collection");
  const GroupsPage = GroupsRoute.options.component as () => ReactElement;

  render(<GroupsPage />);

  expect(screen.getByRole("heading", { name: "Groups" })).toBeTruthy();
  expect(screen.getByText("Group administration will be available here.")).toBeTruthy();
  expect(screen.getByTestId("groups-outlet")).toBeTruthy();
  expect(collection).not.toHaveBeenCalled();
});
