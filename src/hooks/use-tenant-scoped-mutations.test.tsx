import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "@/api/client";
import type { BookingType } from "@/api/booking-types";
import { bookingTypesKeys, resourcesKeys, tenantSettingsKeys } from "@/api/query-keys";
import type { Resource } from "@/api/resources";
import type { TenantSettings } from "@/api/tenant-settings";
import { useUpdateBookingTypeMutation } from "./use-booking-types";
import { useUpdateResourceMutation } from "./use-resources";
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
const resource: Resource = {
  id: "resource-1",
  name: "Room",
  base_rate_minor_units: 100,
  archived: false,
  created: "2026-01-01T00:00:00Z",
  updated: "2026-01-01T00:00:00Z",
};
const settings: TenantSettings = { id: "tenant-1", currency: "DKK", locale: "da-DK" };

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

afterEach(() => {
  pocketbase.authStore.clear();
  vi.restoreAllMocks();
});

it("keeps booking-type rollback scoped to the tenant captured at mutation start", async () => {
  pocketbase.authStore.save("token", { tenant: "tenant-1" } as never);
  const { queryClient, wrapper } = setup();
  const tenantOneList = bookingTypesKeys.list();
  queryClient.setQueryData(tenantOneList, [bookingType]);
  let rejectUpdate!: (reason: unknown) => void;
  vi.spyOn(pocketbase, "collection").mockReturnValue({
    update: vi.fn().mockReturnValue(new Promise((_resolve, reject) => (rejectUpdate = reject))),
  } as never);
  const { result } = renderHook(() => useUpdateBookingTypeMutation(), { wrapper });
  const mutation = result.current.mutateAsync({
    id: bookingType.id,
    input: { surcharge_minor_units: 200 },
  });
  await waitFor(() =>
    expect(queryClient.getQueryData<BookingType[]>(tenantOneList)?.[0]).toMatchObject({
      surcharge_minor_units: 200,
    }),
  );

  pocketbase.authStore.save("token", { tenant: "tenant-2" } as never);
  const tenantTwoList = bookingTypesKeys.list();
  queryClient.setQueryData(tenantTwoList, [{ ...bookingType, surcharge_minor_units: 900 }]);
  rejectUpdate(new Error("tenant one conflict"));
  await expect(mutation).rejects.toThrow("tenant one conflict");

  expect(queryClient.getQueryData<BookingType[]>(tenantOneList)?.[0]).toEqual(bookingType);
  expect(queryClient.getQueryData<BookingType[]>(tenantTwoList)?.[0]).toMatchObject({
    surcharge_minor_units: 900,
  });
});

it("keeps resource rollback scoped to the tenant captured at mutation start", async () => {
  pocketbase.authStore.save("token", { tenant: "tenant-1" } as never);
  const { queryClient, wrapper } = setup();
  const tenantOneList = resourcesKeys.list();
  queryClient.setQueryData(tenantOneList, [resource]);
  let rejectUpdate!: (reason: unknown) => void;
  vi.spyOn(pocketbase, "collection").mockReturnValue({
    update: vi.fn().mockReturnValue(new Promise((_resolve, reject) => (rejectUpdate = reject))),
  } as never);
  const { result } = renderHook(() => useUpdateResourceMutation(), { wrapper });
  const mutation = result.current.mutateAsync({
    id: resource.id,
    input: { name: "Tenant one update", base_rate_minor_units: 200 },
  });
  await waitFor(() =>
    expect(queryClient.getQueryData<Resource[]>(tenantOneList)?.[0]?.name).toBe(
      "Tenant one update",
    ),
  );

  pocketbase.authStore.save("token", { tenant: "tenant-2" } as never);
  const tenantTwoList = resourcesKeys.list();
  queryClient.setQueryData(tenantTwoList, [{ ...resource, name: "Tenant two value" }]);
  rejectUpdate(new Error("tenant one conflict"));
  await expect(mutation).rejects.toThrow("tenant one conflict");

  expect(queryClient.getQueryData<Resource[]>(tenantOneList)?.[0]).toEqual(resource);
  expect(queryClient.getQueryData<Resource[]>(tenantTwoList)?.[0]).toMatchObject({
    name: "Tenant two value",
  });
});

it("keeps tenant-settings rollback scoped to the tenant captured at mutation start", async () => {
  pocketbase.authStore.save("token", { tenant: "tenant-1" } as never);
  const { queryClient, wrapper } = setup();
  const tenantOneKey = tenantSettingsKeys.current();
  queryClient.setQueryData(tenantOneKey, settings);
  let rejectUpdate!: (reason: unknown) => void;
  vi.spyOn(pocketbase, "collection").mockReturnValue({
    update: vi.fn().mockReturnValue(new Promise((_resolve, reject) => (rejectUpdate = reject))),
  } as never);
  const { result } = renderHook(() => useUpdateTenantSettingsMutation(), { wrapper });
  const mutation = result.current.mutateAsync({ locale: "en-GB" });
  await waitFor(() =>
    expect(queryClient.getQueryData<TenantSettings>(tenantOneKey)?.locale).toBe("en-GB"),
  );

  pocketbase.authStore.save("token", { tenant: "tenant-2" } as never);
  const tenantTwoKey = tenantSettingsKeys.current();
  queryClient.setQueryData(tenantTwoKey, { ...settings, id: "tenant-2", locale: "fr-FR" });
  rejectUpdate(new Error("tenant one locale conflict"));
  await expect(mutation).rejects.toThrow("tenant one locale conflict");

  expect(queryClient.getQueryData<TenantSettings>(tenantOneKey)).toEqual(settings);
  expect(queryClient.getQueryData<TenantSettings>(tenantTwoKey)).toMatchObject({
    locale: "fr-FR",
  });
});
