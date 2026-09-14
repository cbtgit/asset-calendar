import { useState } from "react";
import type { BookingType } from "@/api/booking-types";
import { useArchiveBookingTypeMutation } from "@/hooks/use-booking-types";
import { BookingTypeRow } from "./booking-type-row";
import { CreateBookingTypeForm } from "./create-booking-type-form";

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
  const confirmArchive = () => {
    if (!pending) return;
    archive.mutate(pending.id, { onSettled: () => setPending(null) });
  };
  return (
    <section className="booking-types-directory" aria-label="Booking types directory">
      <p>System booking types are protected. Custom types can be edited until they are archived.</p>
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
            className="booking-types-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="archive-booking-type-title"
          >
            <h2 id="archive-booking-type-title">Archive {pending.name}?</h2>
            <p>Archiving is permanent. Existing bookings remain unchanged.</p>
            <div className="booking-types-dialog-actions">
              <button type="button" onClick={() => setPending(null)} disabled={archive.isPending}>
                Cancel
              </button>
              <button
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
