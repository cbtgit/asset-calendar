import { BookingTypesLoaded } from "./booking-types-loaded";
import { useBookingTypesQuery } from "@/hooks/use-booking-types";
import { useTenantSettingsQuery } from "@/hooks/use-tenant-settings";
import "./booking-types-directory.css";

export function BookingTypesDirectory() {
  const query = useBookingTypesQuery();
  const settings = useTenantSettingsQuery();
  if (query.isPending || settings.isPending) return <p role="status">Loading booking types…</p>;
  if (query.isError || settings.isError) {
    const error = query.error ?? settings.error;
    return (
      <div className="booking-types-state" role="alert">
        <p>{error?.message}</p>
        <button
          type="button"
          onClick={() => {
            void query.refetch();
            void settings.refetch();
          }}
        >
          Retry
        </button>
      </div>
    );
  }
  return (
    <BookingTypesLoaded
      types={query.data}
      locale={settings.data.locale}
      currency={settings.data.currency}
    />
  );
}
