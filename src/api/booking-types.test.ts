import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "./client";
import { signOut } from "./auth";
import { createBookingType, getBookingTypes } from "./booking-types";

beforeEach(() => {
  signOut();
  pocketbase.authStore.save("token", {
    id: "user-1",
    collectionId: "users",
    collectionName: "users",
    email: "person@example.test",
    tenant: "tenant-id",
  });
});

afterEach(() => {
  signOut();
  vi.restoreAllMocks();
});

it("loads booking types sorted by name", async () => {
  const bookingTypes = [
    {
      id: "booking-type-1",
      tenant: "tenant-id",
      name: "Training",
      name_normalized: "training",
      surcharge_minor_units: 1250,
      archived_at: "",
      created: "2026-01-01T00:00:00Z",
      updated: "2026-01-01T00:00:00Z",
    },
  ];
  const getFullList = vi.fn().mockResolvedValue(bookingTypes);
  vi.spyOn(pocketbase, "collection").mockReturnValue({ getFullList } as never);

  await expect(getBookingTypes()).resolves.toEqual(bookingTypes);
  expect(getFullList).toHaveBeenCalledWith({ sort: "name" });
});

it("creates a booking type with a tenant-scoped payload", async () => {
  const created = {
    id: "booking-type-1",
    tenant: "tenant-id",
    name: "Training",
    name_normalized: "training",
    surcharge_minor_units: 1250,
    archived_at: "",
    created: "2026-01-01T00:00:00Z",
    updated: "2026-01-01T00:00:00Z",
  };
  const create = vi.fn().mockResolvedValue(created);
  vi.spyOn(pocketbase, "collection").mockReturnValue({ create } as never);

  await expect(
    createBookingType({ name: "  Training  ", surchargeMinorUnits: 1250 }),
  ).resolves.toEqual(created);
  expect(create).toHaveBeenCalledWith({
    tenant: "tenant-id",
    name: "Training",
    surcharge_minor_units: 1250,
  });
});

it("rejects creation without an authenticated tenant", async () => {
  signOut();

  await expect(createBookingType({ name: "Training", surchargeMinorUnits: 1250 })).rejects.toThrow(
    "Cannot create a booking type without an authenticated tenant.",
  );
});
