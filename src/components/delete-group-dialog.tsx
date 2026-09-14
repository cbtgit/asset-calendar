import { useEffect, useRef, type RefObject } from "react";
import type { Group } from "@/api/groups";

function trapDialogTabNavigation({
  event,
  dialog,
  focusableElements,
}: {
  event: KeyboardEvent;
  dialog: HTMLElement | null;
  focusableElements: HTMLButtonElement[];
}) {
  if (focusableElements.length === 0) {
    event.preventDefault();
    dialog?.focus();
    return;
  }

  const activeElement = document.activeElement;
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  const boundaryElement = event.shiftKey ? firstElement : lastElement;
  const nextElement = event.shiftKey ? lastElement : firstElement;
  if (activeElement !== boundaryElement && activeElement !== dialog) return;

  event.preventDefault();
  nextElement.focus();
}

function handleDialogKeyDown({
  event,
  dialog,
  cancel,
  confirm,
  onCancel,
}: {
  event: KeyboardEvent;
  dialog: HTMLElement | null;
  cancel: HTMLButtonElement | null;
  confirm: HTMLButtonElement | null;
  onCancel: () => void;
}) {
  if (event.key === "Escape") {
    event.preventDefault();
    onCancel();
    return;
  }

  if (event.key !== "Tab") return;

  const focusableElements = [cancel, confirm].filter(
    (element): element is HTMLButtonElement => element !== null,
  );
  trapDialogTabNavigation({ event, dialog, focusableElements });
}

function useDeleteGroupDialogLifecycle({
  dialogRef,
  cancelRef,
  confirmRef,
  onCancel,
}: {
  dialogRef: RefObject<HTMLElement | null>;
  cancelRef: RefObject<HTMLButtonElement | null>;
  confirmRef: RefObject<HTMLButtonElement | null>;
  onCancel: () => void;
}) {
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;

    cancelRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      handleDialogKeyDown({
        event,
        dialog,
        cancel: cancelRef.current,
        confirm: confirmRef.current,
        onCancel: onCancelRef.current,
      });
    }

    dialog?.addEventListener("keydown", onKeyDown);
    return () => {
      dialog?.removeEventListener("keydown", onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [cancelRef, confirmRef, dialogRef]);
}

export function DeleteGroupDialog({
  group,
  pending,
  onCancel,
  onConfirm,
}: {
  group: Group;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  useDeleteGroupDialogLifecycle({ dialogRef, cancelRef, confirmRef, onCancel });

  return (
    <div className="groups-directory-dialog-backdrop">
      <section
        ref={dialogRef}
        className="groups-directory-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-group-title"
        tabIndex={-1}
      >
        <h2 id="delete-group-title">Delete {group.name}?</h2>
        <p>This action cannot be undone.</p>
        <div className="groups-directory-dialog-actions">
          <button ref={cancelRef} type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            ref={confirmRef}
            className="groups-directory-delete"
            type="button"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? "Deleting…" : "Delete group"}
          </button>
        </div>
      </section>
    </div>
  );
}
