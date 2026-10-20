import { QueryClient } from "@tanstack/react-query";
import { expect, it, vi } from "vite-plus/test";
import { pocketbase } from "./client";
import { bookingDetailQueryOptions } from "./bookings";
import { bookingTypeQueryOptions } from "./booking-types";
import { bookingsKeys, resourcesKeys, bookingTypesKeys, usersKeys } from "./query-keys";
import { resourceQueryOptions } from "./resources";
import { userQueryOptions, type User } from "./users";

const user: User = {
  id: "user-1",
  first_name: "Ada",
  last_name: "Lovelace",
  display_name: "Ada Lovelace",
  email: "ada@example.test",
  account_reference_number: "",
  role: "regular",
  booking_access: "",
  active: true,
  password_setup_pending: false,
  created: "2026-01-01T00:00:00Z",
  updated: "2026-01-01T00:00:00Z",
};

it("uses the detail key for every administration detail query", () => {
  expect(bookingTypeQueryOptions("booking-type-1").queryKey).toEqual(
    bookingTypesKeys.detail("booking-type-1"),
  );
  expect(resourceQueryOptions("resource-1").queryKey).toEqual(resourcesKeys.detail("resource-1"));
  expect(userQueryOptions("user-1").queryKey).toEqual(usersKeys.detail("user-1"));
});

it("uses a permission-scoped detail key for booking queries", () => {
  expect(bookingDetailQueryOptions("booking-1").queryKey).toEqual(
    expect.arrayContaining(["bookings", "detail", "booking-1"]),
  );
  expect(bookingsKeys.detail("tenant-1", "user-1", "regular", "booking-1")).toEqual([
    "bookings",
    "detail",
    "tenant-1",
    "user-1",
    "regular",
    "booking-1",
  ]);
});

it("fetches missing detail data and reuses a fresh cached record", async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const send = vi.spyOn(pocketbase, "send").mockResolvedValue(user);
  const options = userQueryOptions(user.id);

  await expect(queryClient.ensureQueryData(options)).resolves.toEqual(user);
  await expect(queryClient.ensureQueryData(options)).resolves.toEqual(user);
  expect(send).toHaveBeenCalledTimes(1);
});
