import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BookingTypeForm } from "@/components/administration/booking-types/booking-type-form";
import { useTenantDisplaySettings } from "@/hooks/use-tenant-display-settings";

export const Route = createFileRoute("/_authenticated/administration/booking-types/new")({
  component: NewBookingTypePage,
});

function NewBookingTypePage() {
  const navigate = useNavigate();
  const settings = useTenantDisplaySettings();

  return (
    <BookingTypeForm
      locale={settings.locale}
      onCancel={() => void navigate({ to: "/administration/booking-types" })}
      onSuccess={() => void navigate({ to: "/administration/booking-types", replace: true })}
    />
  );
}
