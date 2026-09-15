import { Link } from "@tanstack/react-router";
import { useBookingTypesQuery } from "@/hooks/use-booking-types";

const priceFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatSurcharge(minorUnits: number): string {
  return priceFormatter.format(minorUnits / 100);
}

export function BookingTypesDirectory() {
  const bookingTypes = useBookingTypesQuery();

  if (bookingTypes.isPending) return <p>Loading booking types...</p>;
  if (bookingTypes.error) {
    return <p role="alert">Unable to load booking types: {bookingTypes.error.message}</p>;
  }
  if (bookingTypes.data.length === 0) {
    return <p className="booking-types-empty">No booking types have been created yet.</p>;
  }

  return (
    <ul className="booking-types-list">
      {bookingTypes.data.map((bookingType) => (
        <li className="booking-type-row" key={bookingType.id}>
          <div className="booking-type-name">
            <span className="booking-type-label">Booking type</span>
            <strong>{bookingType.name}</strong>
            <p>{bookingType.archived_at ? "Archived" : "Active"}</p>
          </div>
          <div className="booking-type-price">
            <span className="booking-type-label">Hourly price</span>
            <span>{formatSurcharge(bookingType.surcharge_minor_units)}</span>
          </div>
          <Link
            className="booking-type-edit"
            to="/administration/booking-types/$bookingTypeId/edit"
            params={{ bookingTypeId: bookingType.id }}
            aria-label={`Edit ${bookingType.name}`}
          >
            Edit
          </Link>
        </li>
      ))}
    </ul>
  );
}
