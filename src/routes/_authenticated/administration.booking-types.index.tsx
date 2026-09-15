import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/base/Button";
import "./administration.booking-types.css";

export const Route = createFileRoute("/_authenticated/administration/booking-types/")({
  component: BookingTypesPage,
});

function BookingTypesPage() {
  const navigate = useNavigate();

  return (
    <>
      <p className="eyebrow">Administration</p>
      <div className="booking-types-header">
        <div>
          <h1>Booking Types</h1>
          <p>Booking type administration will be available here.</p>
        </div>
        <Button
          variant="primary"
          onClick={() => void navigate({ to: "/administration/booking-types/new" })}
        >
          New Booking Type
        </Button>
      </div>
    </>
  );
}
