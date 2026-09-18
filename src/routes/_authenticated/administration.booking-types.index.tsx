import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { bookingTypesQueryOptions } from "@/api/booking-types";
import { Button } from "@/components/base/Button";
import { BookingTypesDirectory } from "@/components/administration/booking-types/booking-types-directory";
import { queryClient } from "@/lib/query-client";
import "./administration.booking-types.css";

export const Route = createFileRoute("/_authenticated/administration/booking-types/")({
  loader: () => {
    void queryClient.prefetchQuery(bookingTypesQueryOptions()).catch(() => undefined);
  },
  component: BookingTypesPage,
});

function focusHeading(heading: HTMLHeadingElement | null) {
  heading?.focus();
}

function BookingTypesPage() {
  const navigate = useNavigate();

  return (
    <>
      <p className="eyebrow">Administration</p>
      <div className="booking-types-header">
        <div>
          <h1 ref={focusHeading} tabIndex={-1}>
            Booking Types
          </h1>
          <p>Manage the hourly surcharges used for bookings.</p>
        </div>
        <Button
          variant="primary"
          onClick={() => void navigate({ to: "/administration/booking-types/new" })}
        >
          New Booking Type
        </Button>
      </div>
      <BookingTypesDirectory />
    </>
  );
}
