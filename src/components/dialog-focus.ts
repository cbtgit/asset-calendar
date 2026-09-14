import { useEffect, useRef, type RefObject } from "react";

function trapDialogTabNavigation(
  event: KeyboardEvent,
  dialog: HTMLElement | null,
  focusableElements: HTMLButtonElement[],
) {
  if (focusableElements.length === 0) {
    event.preventDefault();
    dialog?.focus();
    return;
  }

  const activeElement = document.activeElement;
  const firstElement = focusableElements[0];
  const lastElement = focusableElements.at(-1);
  const boundaryElement = event.shiftKey ? firstElement : lastElement;
  const nextElement = event.shiftKey ? lastElement : firstElement;
  if (activeElement !== boundaryElement && activeElement !== dialog) return;

  event.preventDefault();
  nextElement?.focus();
}

export function useDialogLifecycle({
  dialogRef,
  cancelRef,
  confirmRef,
  onCancel,
  active,
}: {
  dialogRef: RefObject<HTMLElement | null>;
  cancelRef: RefObject<HTMLButtonElement | null>;
  confirmRef: RefObject<HTMLButtonElement | null>;
  onCancel: () => void;
  active: boolean;
}) {
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (!active) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    cancelRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancelRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusableElements = [cancelRef.current, confirmRef.current].filter(
        (element): element is HTMLButtonElement => element !== null && !element.disabled,
      );
      trapDialogTabNavigation(event, dialog, focusableElements);
    }

    dialog?.addEventListener("keydown", onKeyDown);
    return () => {
      dialog?.removeEventListener("keydown", onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [active, cancelRef, confirmRef, dialogRef]);
}
