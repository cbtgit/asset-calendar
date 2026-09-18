import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "./client";
import { signOut } from "./auth";
import {
  createBookingType,
  getBookingType,
  getBookingTypes,
  updateBookingType,
} from "./booking-types";

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
      color: null,
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

it("loads one booking type for editing", async () => {
  const bookingType = {
    id: "booking-type-1",
    tenant: "tenant-id",
    name: "Training",
    name_normalized: "training",
    surcharge_minor_units: 1250,
    color: null,
    archived_at: "",
    created: "2026-01-01T00:00:00Z",
    updated: "2026-01-01T00:00:00Z",
  };
  const getOne = vi.fn().mockResolvedValue(bookingType);
  vi.spyOn(pocketbase, "collection").mockReturnValue({ getOne } as never);

  await expect(getBookingType("booking-type-1")).resolves.toEqual(bookingType);
  expect(getOne).toHaveBeenCalledWith("booking-type-1");
});

it("creates a booking type with a tenant-scoped payload", async () => {
  const created = {
    id: "booking-type-1",
    tenant: "tenant-id",
    name: "Training",
    name_normalized: "training",
    surcharge_minor_units: 1250,
    color: "#168C6C",
    archived_at: "",
    created: "2026-01-01T00:00:00Z",
    updated: "2026-01-01T00:00:00Z",
  };
  const create = vi.fn().mockResolvedValue(created);
  vi.spyOn(pocketbase, "collection").mockReturnValue({ create } as never);

  await expect(
    createBookingType({ name: "  Training  ", surchargeMinorUnits: 1250, color: "#168C6C" }),
  ).resolves.toEqual(created);
  expect(create).toHaveBeenCalledWith({
    tenant: "tenant-id",
    name: "Training",
    surcharge_minor_units: 1250,
    nonbillable: false,
    color: "#168C6C",
  });
});

it("creates a non-billable booking type with an explicit capability", async () => {
  const create = vi.fn().mockResolvedValue({});
  vi.spyOn(pocketbase, "collection").mockReturnValue({ create } as never);

  await createBookingType({ name: "Maintenance", nonbillable: true });

  expect(create).toHaveBeenCalledWith({
    tenant: "tenant-id",
    name: "Maintenance",
    surcharge_minor_units: 0,
    nonbillable: true,
    color: null,
  });
});

it("rejects creation without an authenticated tenant", async () => {
  signOut();

  await expect(createBookingType({ name: "Training", surchargeMinorUnits: 1250 })).rejects.toThrow(
    "Cannot create a booking type without an authenticated tenant.",
  );
});

it("updates a booking type without changing its tenant", async () => {
  const updated = {
    id: "booking-type-1",
    tenant: "tenant-id",
    name: "Updated training",
    name_normalized: "updated training",
    surcharge_minor_units: 1500,
    color: "#CF7B36",
    archived_at: "",
    created: "2026-01-01T00:00:00Z",
    updated: "2026-01-02T00:00:00Z",
  };
  const update = vi.fn().mockResolvedValue(updated);
  vi.spyOn(pocketbase, "collection").mockReturnValue({ update } as never);

  await expect(
    updateBookingType("booking-type-1", {
      name: "  Updated training  ",
      surchargeMinorUnits: 1500,
      color: "#CF7B36",
    }),
  ).resolves.toEqual(updated);
  expect(update).toHaveBeenCalledWith("booking-type-1", {
    name: "Updated training",
    surcharge_minor_units: 1500,
    nonbillable: false,
    color: "#CF7B36",
  });
});
