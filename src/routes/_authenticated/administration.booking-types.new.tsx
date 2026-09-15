import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BookingTypeForm } from "@/components/administration/booking-types/booking-type-form";

export const Route = createFileRoute("/_authenticated/administration/booking-types/new")({
  component: NewBookingTypePage,
});

function NewBookingTypePage() {
  const navigate = useNavigate();

  return (
    <BookingTypeForm
      onCancel={() => void navigate({ to: "/administration/booking-types" })}
      onSuccess={() => void navigate({ to: "/administration/booking-types", replace: true })}
    />
  );
}
