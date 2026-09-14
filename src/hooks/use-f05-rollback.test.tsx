import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "@/api/client";
import { bookingTypesKeys, tenantSettingsKeys } from "@/api/query-keys";
import type { BookingType } from "@/api/booking-types";
import type { TenantSettings } from "@/api/tenant-settings";
import {
  useArchiveBookingTypeMutation,
  useCreateBookingTypeMutation,
  useUpdateBookingTypeMutation,
} from "./use-booking-types";
import { useUpdateTenantSettingsMutation } from "./use-tenant-settings";

const bookingType: BookingType = {
  id: "type-1",
  name: "After hours",
  system_kind: "custom",
  surcharge_minor_units: 1250,
  billable: true,
  resource_blocking: true,
  archived: false,
};
const secondBookingType: BookingType = { ...bookingType, id: "type-2", name: "Morning" };

const settings: TenantSettings = { id: "tenant-1", currency: "DKK", locale: "da-DK" };

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  queryClient.setQueryData(bookingTypesKeys.list(), [bookingType, secondBookingType]);
  queryClient.setQueryData(bookingTypesKeys.selection(), [bookingType, secondBookingType]);
  queryClient.setQueryData(tenantSettingsKeys.current(), settings);
  return { queryClient, wrapper };
}

afterEach(() => {
  pocketbase.authStore.clear();
  vi.restoreAllMocks();
});

it("optimistically archives booking types and rolls back on failure", async () => {
  let rejectArchive!: (reason: unknown) => void;
  vi.spyOn(pocketbase, "collection").mockReturnValue({
    update: vi.fn().mockReturnValue(new Promise((_resolve, reject) => (rejectArchive = reject))),
  } as never);
  const { queryClient, wrapper } = setup();
  const { result } = renderHook(() => useArchiveBookingTypeMutation(), { wrapper });

  let mutation!: Promise<unknown>;
  await act(async () => {
    mutation = result.current.mutateAsync(bookingType.id);
    await Promise.resolve();
  });
  expect(queryClient.getQueryData<BookingType[]>(bookingTypesKeys.list())?.[0]?.archived).toBe(
    true,
  );
  expect(queryClient.getQueryData<BookingType[]>(bookingTypesKeys.selection())).toEqual([
    secondBookingType,
  ]);
  rejectArchive(new Error("conflict"));
  await expect(mutation).rejects.toThrow("conflict");
  expect(queryClient.getQueryData(bookingTypesKeys.list())).toEqual([
    bookingType,
    secondBookingType,
  ]);
  expect(queryClient.getQueryData(bookingTypesKeys.selection())).toEqual([
    bookingType,
    secondBookingType,
  ]);
});

it("adds a safe custom booking type to the cached selection optimistically", async () => {
  vi.spyOn(pocketbase, "collection").mockReturnValue({
    create: vi.fn().mockResolvedValue({ id: "type-2" }),
  } as never);
  vi.spyOn(pocketbase, "send").mockResolvedValue({ ...bookingType, id: "type-2" });
  const { queryClient, wrapper } = setup();
  const { result } = renderHook(() => useCreateBookingTypeMutation(), { wrapper });

  await act(() =>
    result.current.mutateAsync({
      name: "Weekend",
      surcharge_minor_units: 500,
      system_kind: "custom",
    }),
  );

  expect(queryClient.getQueryData(bookingTypesKeys.selection())).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: "Weekend", system_kind: "custom", archived: false }),
    ]),
  );
});

it("optimistically updates settings and restores the locale on failure", async () => {
  pocketbase.authStore.save("token", { tenant: settings.id } as never);
  let rejectUpdate!: (reason: unknown) => void;
  vi.spyOn(pocketbase, "collection").mockReturnValue({
    update: vi.fn().mockReturnValue(new Promise((_resolve, reject) => (rejectUpdate = reject))),
  } as never);
  const { queryClient, wrapper } = setup();
  const { result } = renderHook(() => useUpdateTenantSettingsMutation(), { wrapper });

  let mutation!: Promise<unknown>;
  await act(async () => {
    mutation = result.current.mutateAsync({ locale: "en-GB" });
    await Promise.resolve();
  });
  expect(queryClient.getQueryData<TenantSettings>(tenantSettingsKeys.current())?.locale).toBe(
    "en-GB",
  );
  rejectUpdate(new Error("invalid locale"));
  await expect(mutation).rejects.toThrow("invalid locale");
  expect(queryClient.getQueryData(tenantSettingsKeys.current())).toEqual(settings);
});

it("optimistically updates booking-type rates and reconciles after success", async () => {
  vi.spyOn(pocketbase, "collection").mockReturnValue({
    update: vi.fn().mockResolvedValue({}),
  } as never);
  vi.spyOn(pocketbase, "send").mockResolvedValue({ ...bookingType, surcharge_minor_units: 1500 });
  const { queryClient, wrapper } = setup();
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const { result } = renderHook(() => useUpdateBookingTypeMutation(), { wrapper });

  await act(() =>
    result.current.mutateAsync({
      id: bookingType.id,
      input: { surcharge_minor_units: 1500 },
    }),
  );
  expect(queryClient.getQueryData<BookingType[]>(bookingTypesKeys.list())?.[0]).toMatchObject({
    surcharge_minor_units: 1500,
  });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: bookingTypesKeys.all });
});

it("rolls back only the failed booking type during overlapping updates", async () => {
  const rejecters = new Map<string, (reason: unknown) => void>();
  vi.spyOn(pocketbase, "collection").mockReturnValue({
    update: vi.fn().mockImplementation(
      (id: string) =>
        new Promise((_resolve, reject) => {
          rejecters.set(id, reject);
        }),
    ),
  } as never);
  vi.spyOn(pocketbase, "send").mockResolvedValue(bookingType);
  const { queryClient, wrapper } = setup();
  const { result } = renderHook(() => useUpdateBookingTypeMutation(), { wrapper });

  let first!: Promise<unknown>;
  let second!: Promise<unknown>;
  await act(async () => {
    first = result.current.mutateAsync({
      id: bookingType.id,
      input: { surcharge_minor_units: 200 },
    });
    second = result.current.mutateAsync({
      id: secondBookingType.id,
      input: { surcharge_minor_units: 300 },
    });
    await Promise.resolve();
  });

  expect(queryClient.getQueryData<BookingType[]>(bookingTypesKeys.list())).toEqual([
    { ...bookingType, surcharge_minor_units: 200 },
    { ...secondBookingType, surcharge_minor_units: 300 },
  ]);
  rejecters.get(bookingType.id)?.(new Error("first conflict"));
  await expect(first).rejects.toThrow("first conflict");
  expect(queryClient.getQueryData<BookingType[]>(bookingTypesKeys.list())).toEqual([
    bookingType,
    { ...secondBookingType, surcharge_minor_units: 300 },
  ]);
  rejecters.get(secondBookingType.id)?.(new Error("second conflict"));
  await expect(second).rejects.toThrow("second conflict");
});

it("serializes overlapping updates for one booking type", async () => {
  let firstReject!: (reason: unknown) => void;
  let secondReject!: (reason: unknown) => void;
  let calls = 0;
  const update = vi.fn().mockImplementation(
    () =>
      new Promise((_resolve, reject) => {
        calls += 1;
        if (calls === 1) firstReject = reject;
        else secondReject = reject;
      }),
  );
  vi.spyOn(pocketbase, "collection").mockReturnValue({ update } as never);
  const { queryClient, wrapper } = setup();
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const { result } = renderHook(() => useUpdateBookingTypeMutation(), { wrapper });

  const first = result.current.mutateAsync({
    id: bookingType.id,
    input: { surcharge_minor_units: 200 },
  });
  const second = result.current.mutateAsync({
    id: bookingType.id,
    input: { surcharge_minor_units: 300 },
  });
  await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
  expect(queryClient.getQueryData<BookingType[]>(bookingTypesKeys.list())?.[0]).toMatchObject({
    surcharge_minor_units: 200,
  });

  firstReject(new Error("first conflict"));
  await expect(first).rejects.toThrow("first conflict");
  expect(invalidate).not.toHaveBeenCalled();
  await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
  expect(queryClient.getQueryData<BookingType[]>(bookingTypesKeys.list())?.[0]).toMatchObject({
    surcharge_minor_units: 300,
  });

  secondReject(new Error("second conflict"));
  await expect(second).rejects.toThrow("second conflict");
  expect(invalidate).toHaveBeenCalledWith({ queryKey: bookingTypesKeys.all });
});

it("serializes overlapping locale updates", async () => {
  pocketbase.authStore.save("token", { tenant: settings.id } as never);
  let firstReject!: (reason: unknown) => void;
  let secondReject!: (reason: unknown) => void;
  let calls = 0;
  const update = vi.fn().mockImplementation(
    () =>
      new Promise((_resolve, reject) => {
        calls += 1;
        if (calls === 1) firstReject = reject;
        else secondReject = reject;
      }),
  );
  vi.spyOn(pocketbase, "collection").mockReturnValue({ update } as never);
  const { queryClient, wrapper } = setup();
  const { result } = renderHook(() => useUpdateTenantSettingsMutation(), { wrapper });

  const first = result.current.mutateAsync({ locale: "en-GB" });
  const second = result.current.mutateAsync({ locale: "fr-FR" });
  await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
  expect(queryClient.getQueryData<TenantSettings>(tenantSettingsKeys.current())?.locale).toBe(
    "en-GB",
  );

  firstReject(new Error("first locale conflict"));
  await expect(first).rejects.toThrow("first locale conflict");
  await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
  expect(queryClient.getQueryData<TenantSettings>(tenantSettingsKeys.current())?.locale).toBe(
    "fr-FR",
  );

  secondReject(new Error("second locale conflict"));
  await expect(second).rejects.toThrow("second locale conflict");
  expect(queryClient.getQueryData<TenantSettings>(tenantSettingsKeys.current())).toEqual(settings);
});
