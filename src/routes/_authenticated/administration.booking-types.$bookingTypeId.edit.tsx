import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getBookingType } from "@/api/booking-types";
import { Loading } from "@/components/base/Loading";
import { BookingTypeForm } from "@/components/administration/booking-types/booking-type-form";

export const Route = createFileRoute(
  "/_authenticated/administration/booking-types/$bookingTypeId/edit",
)({
  loader: ({ params }) => getBookingType(params.bookingTypeId),
  pendingComponent: () => <Loading className="loading-page" />,
  component: BookingTypeEditPage,
  shouldReload: true,
  gcTime: 0,
});

function BookingTypeEditPage() {
  const bookingType = Route.useLoaderData();
  const navigate = useNavigate();

  return (
    <BookingTypeForm
      mode="edit"
      initialBookingType={bookingType}
      onCancel={() => void navigate({ to: "/administration/booking-types", replace: true })}
      onSuccess={() => void navigate({ to: "/administration/booking-types", replace: true })}
    />
  );
}
