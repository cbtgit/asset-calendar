import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "@/api/client";
import { Route as GroupsRoute } from "./_authenticated/groups";

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
  expect(collection).not.toHaveBeenCalled();
});
