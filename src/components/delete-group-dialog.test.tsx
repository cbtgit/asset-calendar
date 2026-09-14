import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { DeleteGroupDialog } from "./delete-group-dialog";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function DialogHarness() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Delete Operations
      </button>
      {isOpen ? (
        <DeleteGroupDialog
          group={{
            id: "group-1",
            name: "Operations",
            member_count: 0,
            created: "2026-01-01T00:00:00Z",
            updated: "2026-01-01T00:00:00Z",
          }}
          pending={false}
          onCancel={() => setIsOpen(false)}
          onConfirm={vi.fn()}
        />
      ) : null}
    </>
  );
}

it("moves focus into the dialog, traps tab navigation, and restores focus on cancel", () => {
  render(<DialogHarness />);

  const trigger = screen.getByRole("button", { name: "Delete Operations" });
  trigger.focus();
  fireEvent.click(trigger);

  const dialog = screen.getByRole("dialog", { name: "Delete Operations?" });
  const cancel = screen.getByRole("button", { name: "Cancel" });
  const confirm = screen.getByRole("button", { name: "Delete group" });
  expect(document.activeElement).toBe(cancel);

  fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(confirm);

  fireEvent.keyDown(dialog, { key: "Tab" });
  expect(document.activeElement).toBe(cancel);

  fireEvent.click(cancel);
  expect(screen.queryByRole("dialog", { name: "Delete Operations?" })).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

it("dismisses the dialog on Escape and restores focus to the trigger", () => {
  render(<DialogHarness />);

  const trigger = screen.getByRole("button", { name: "Delete Operations" });
  trigger.focus();
  fireEvent.click(trigger);

  fireEvent.keyDown(screen.getByRole("dialog", { name: "Delete Operations?" }), {
    key: "Escape",
  });

  expect(screen.queryByRole("dialog", { name: "Delete Operations?" })).toBeNull();
  expect(document.activeElement).toBe(trigger);
});
