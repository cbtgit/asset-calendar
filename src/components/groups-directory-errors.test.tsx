import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { GroupsDirectoryLoadError } from "./groups-directory-load-error";
import { GroupsDirectoryMutationError } from "./groups-directory-mutation-error";

afterEach(cleanup);

it("announces a retryable load error and retries on request", () => {
  const onRetry = vi.fn();
  render(<GroupsDirectoryLoadError message="offline" onRetry={onRetry} />);

  expect(screen.getByRole("alert").textContent).toContain("offline");
  expect(screen.getByRole("alert").parentElement?.getAttribute("aria-live")).toBe("polite");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(onRetry).toHaveBeenCalledOnce();
});

it("announces a delete failure", () => {
  render(<GroupsDirectoryMutationError message="assigned members" />);

  expect(screen.getByRole("alert").textContent).toBe("Unable to delete group: assigned members");
});
