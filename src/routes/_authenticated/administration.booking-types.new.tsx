import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/base/Button";

export const Route = createFileRoute("/_authenticated/administration/booking-types/new")({
  component: NewBookingTypePage,
});

function NewBookingTypePage() {
  const navigate = useNavigate();

  return (
    <>
      <p className="eyebrow">Administration</p>
      <h1>New Booking Type</h1>
      <p>Booking type creation will be available here.</p>
      <Button onClick={() => void navigate({ to: "/administration/booking-types" })}>
        Back to Booking Types
      </Button>
    </>
  );
}
