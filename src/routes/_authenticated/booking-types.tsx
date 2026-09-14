import { createFileRoute, redirect } from "@tanstack/react-router";
import { isAdministrator, getAuthSnapshot } from "@/api/auth";
import { BookingTypesDirectory } from "@/components/booking-types-directory";

export const Route = createFileRoute("/_authenticated/booking-types")({
  beforeLoad: () => {
    if (!isAdministrator(getAuthSnapshot().user)) throw redirect({ to: "/calendar" });
  },
  component: BookingTypesPage,
});

function BookingTypesPage() {
  return (
    <>
      <p className="eyebrow">Administration</p>
      <h1>Booking types</h1>
      <BookingTypesDirectory />
    </>
  );
}
