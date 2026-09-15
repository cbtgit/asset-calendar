import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/administration/booking-types")({
  component: AdministrationBookingTypesPage,
});

function AdministrationBookingTypesPage() {
  return <Outlet />;
}
