import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/base/Button";
import "./administration.booking-types.css";

export const Route = createFileRoute("/_authenticated/administration/booking-types")({
  component: BookingTypesPage,
});

function BookingTypesPage() {
  return (
    <>
      <p className="eyebrow">Administration</p>
      <div className="booking-types-header">
        <div>
          <h1>Booking Types</h1>
          <p>Booking type administration will be available here.</p>
        </div>
        <Button variant="primary">New Booking Type</Button>
      </div>
    </>
  );
}
