import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "@/api/client";
import { signOut } from "@/api/auth";
import type { BookingType } from "@/api/booking-types";
import { bookingTypesKeys } from "@/api/query-keys";
import { useCreateBookingTypeMutation, useUpdateBookingTypeMutation } from "./use-booking-types";

const bookingType: BookingType = {
  id: "booking-type-1",
  tenant: "tenant-id",
  name: "Operations",
  name_normalized: "operations",
  surcharge_minor_units: 1250,
  archived_at: "",
  created: "2026-01-01T00:00:00Z",
  updated: "2026-01-01T00:00:00Z",
};

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  queryClient.setQueryData(bookingTypesKeys.list(), [bookingType]);
  return { queryClient, wrapper };
}

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

it("optimistically adds and sorts a booking type", async () => {
  let resolveCreate!: (value: BookingType) => void;
  const create = vi.fn().mockReturnValue(
    new Promise<BookingType>((resolve) => {
      resolveCreate = resolve;
    }),
  );
  vi.spyOn(pocketbase, "collection").mockReturnValue({ create } as never);
  const { queryClient, wrapper } = setup();
  const { result } = renderHook(() => useCreateBookingTypeMutation(), { wrapper });

  let mutation!: Promise<unknown>;
  await act(async () => {
    mutation = result.current.mutateAsync({ name: " New type ", surchargeMinorUnits: 250 });
    await Promise.resolve();
  });
  expect(
    queryClient.getQueryData<BookingType[]>(bookingTypesKeys.list())?.map(({ name }) => name),
  ).toEqual(["New type", "Operations"]);

  resolveCreate({ ...bookingType, id: "booking-type-2", name: "New type" });
  await mutation;
});

it("rolls back a failed booking type create and invalidates the list", async () => {
  const error = Object.assign(new Error("Duplicate"), { status: 409 });
  let rejectCreate!: (reason: unknown) => void;
  const create = vi.fn().mockReturnValue(
    new Promise<never>((_resolve, reject) => {
      rejectCreate = reject;
    }),
  );
  vi.spyOn(pocketbase, "collection").mockReturnValue({ create } as never);
  const { queryClient, wrapper } = setup();
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const { result } = renderHook(() => useCreateBookingTypeMutation(), { wrapper });

  let mutation!: Promise<unknown>;
  await act(async () => {
    mutation = result.current.mutateAsync({ name: "Duplicate", surchargeMinorUnits: 250 });
    await Promise.resolve();
  });
  expect(queryClient.getQueryData<BookingType[]>(bookingTypesKeys.list())).toHaveLength(2);

  rejectCreate(error);
  await expect(mutation).rejects.toMatchObject({ kind: "conflict" });
  expect(queryClient.getQueryData<BookingType[]>(bookingTypesKeys.list())).toEqual([bookingType]);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: bookingTypesKeys.list() });
});

it("optimistically updates and sorts a booking type", async () => {
  let resolveUpdate!: (value: BookingType) => void;
  const update = vi.fn().mockReturnValue(
    new Promise<BookingType>((resolve) => {
      resolveUpdate = resolve;
    }),
  );
  vi.spyOn(pocketbase, "collection").mockReturnValue({ update } as never);
  const { queryClient, wrapper } = setup();
  const { result } = renderHook(() => useUpdateBookingTypeMutation(), { wrapper });

  let mutation!: Promise<unknown>;
  await act(async () => {
    mutation = result.current.mutateAsync({
      id: bookingType.id,
      input: { name: "Accounting", surchargeMinorUnits: 250 },
    });
    await Promise.resolve();
  });
  expect(queryClient.getQueryData<BookingType[]>(bookingTypesKeys.list())).toEqual([
    {
      ...bookingType,
      name: "Accounting",
      name_normalized: "accounting",
      surcharge_minor_units: 250,
    },
  ]);

  resolveUpdate({ ...bookingType, name: "Accounting", surcharge_minor_units: 250 });
  await mutation;
});

it("rolls back a failed booking type update", async () => {
  const error = Object.assign(new Error("Duplicate"), { status: 409 });
  let rejectUpdate!: (reason: unknown) => void;
  const update = vi.fn().mockReturnValue(
    new Promise<never>((_resolve, reject) => {
      rejectUpdate = reject;
    }),
  );
  vi.spyOn(pocketbase, "collection").mockReturnValue({ update } as never);
  const { queryClient, wrapper } = setup();
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const { result } = renderHook(() => useUpdateBookingTypeMutation(), { wrapper });

  let mutation!: Promise<unknown>;
  await act(async () => {
    mutation = result.current.mutateAsync({
      id: bookingType.id,
      input: { name: "Duplicate", surchargeMinorUnits: 250 },
    });
    await Promise.resolve();
  });

  rejectUpdate(error);
  await expect(mutation).rejects.toMatchObject({ kind: "conflict" });
  expect(queryClient.getQueryData<BookingType[]>(bookingTypesKeys.list())).toEqual([bookingType]);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: bookingTypesKeys.list() });
});
