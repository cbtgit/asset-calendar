import { useEffect, useRef, type RefObject } from "react";
import { Button } from "@/components/base/Button";
import type { CalendarBooking } from "@/api/bookings";

function useDeleteBookingDialogLifecycle({
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
      if (event.key === "Escape") {
        event.preventDefault();
        onCancelRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusableElements = [cancelRef.current, confirmRef.current].filter(
        (element): element is HTMLButtonElement => element !== null,
      );
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

    dialog?.addEventListener("keydown", onKeyDown);
    return () => {
      dialog?.removeEventListener("keydown", onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [cancelRef, confirmRef, dialogRef]);
}

export function DeleteBookingDialog({
  booking,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  booking: CalendarBooking;
  pending: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  useDeleteBookingDialogLifecycle({ dialogRef, cancelRef, confirmRef, onCancel });

  return (
    <div className="booking-delete-dialog-backdrop">
      <section
        ref={dialogRef}
        className="booking-delete-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-booking-title"
        aria-describedby="delete-booking-description"
        tabIndex={-1}
      >
        <h2 id="delete-booking-title">Delete this booking?</h2>
        <p id="delete-booking-description">
          This permanently removes the booking for {booking.booker_display_name}.
        </p>
        {error ? (
          <p className="booking-form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="booking-delete-dialog-actions">
          <Button ref={cancelRef} type="button" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button
            ref={confirmRef}
            type="button"
            variant="danger"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? "Deleting..." : "Delete booking"}
          </Button>
        </div>
      </section>
    </div>
  );
}
