import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "@/api/client";
import { bookingTypesKeys, tenantSettingsKeys } from "@/api/query-keys";
import type { BookingType } from "@/api/booking-types";
import type { TenantSettings } from "@/api/tenant-settings";
import { useArchiveBookingTypeMutation, useUpdateBookingTypeMutation } from "./use-booking-types";
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

const settings: TenantSettings = { id: "tenant-1", currency: "DKK", locale: "da-DK" };

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  queryClient.setQueryData(bookingTypesKeys.list(), [bookingType]);
  queryClient.setQueryData(bookingTypesKeys.selection(), [bookingType]);
  queryClient.setQueryData(tenantSettingsKeys.current(), settings);
  return { queryClient, wrapper };
}

afterEach(() => vi.restoreAllMocks());

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
  expect(queryClient.getQueryData<BookingType[]>(bookingTypesKeys.selection())).toEqual([]);
  rejectArchive(new Error("conflict"));
  await expect(mutation).rejects.toThrow("conflict");
  expect(queryClient.getQueryData(bookingTypesKeys.list())).toEqual([bookingType]);
  expect(queryClient.getQueryData(bookingTypesKeys.selection())).toEqual([bookingType]);
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
