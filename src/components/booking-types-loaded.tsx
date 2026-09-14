import { useEffect, useRef, useState } from "react";
import type { BookingType } from "@/api/booking-types";
import { useArchiveBookingTypeMutation } from "@/hooks/use-booking-types";
import { BookingTypeRow } from "./booking-type-row";
import { CreateBookingTypeForm } from "./create-booking-type-form";
import { useDialogLifecycle } from "./dialog-focus";

export function BookingTypesLoaded({
  types,
  locale,
  currency,
}: {
  types: BookingType[];
  locale: string;
  currency: string;
}) {
  const archive = useArchiveBookingTypeMutation();
  const [pending, setPending] = useState<BookingType | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  useDialogLifecycle({
    dialogRef,
    cancelRef,
    confirmRef,
    onCancel: () => setPending(null),
    active: pending !== null,
  });
  useEffect(() => {
    if (archive.isPending) dialogRef.current?.focus();
  }, [archive.isPending]);
  const confirmArchive = () => {
    if (!pending) return;
    archive.mutate(pending.id, {
      onSuccess: () => {
        setPending(null);
        queueMicrotask(() => statusRef.current?.focus());
      },
      onSettled: () => setPending(null),
    });
  };
  return (
    <section className="booking-types-directory" aria-label="Booking types directory">
      <p ref={statusRef} tabIndex={-1}>
        Regular and Maintenance are protected. Training and custom types can be edited; custom types
        can be archived.
      </p>
      <CreateBookingTypeForm locale={locale} />
      {archive.isError ? <p role="alert">{archive.error.message}</p> : null}
      {types.length === 0 ? (
        <p className="booking-types-empty">No booking types have been configured yet.</p>
      ) : (
        <ul className="booking-types-list">
          {types.map((type) => (
            <BookingTypeRow
              key={type.id}
              type={type}
              locale={locale}
              currency={currency}
              onArchive={setPending}
            />
          ))}
        </ul>
      )}
      {pending ? (
        <div className="booking-types-dialog-backdrop">
          <section
            ref={dialogRef}
            className="booking-types-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="archive-booking-type-title"
            tabIndex={-1}
          >
            <h2 id="archive-booking-type-title">Archive {pending.name}?</h2>
            <p>Archiving is permanent. Existing bookings remain unchanged.</p>
            <div className="booking-types-dialog-actions">
              <button
                ref={cancelRef}
                type="button"
                onClick={() => setPending(null)}
                disabled={archive.isPending}
              >
                Cancel
              </button>
              <button
                ref={confirmRef}
                type="button"
                className="booking-types-danger"
                onClick={confirmArchive}
                disabled={archive.isPending}
              >
                {archive.isPending ? "Archiving…" : "Archive booking type"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
