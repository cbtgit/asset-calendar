import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/administration/booking-types")({
  component: BookingTypesPage,
});

function BookingTypesPage() {
  return (
    <>
      <p className="eyebrow">Administration</p>
      <h1>Booking Types</h1>
      <p>Booking type administration will be available here.</p>
    </>
  );
}
