import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { signOut } from "@/api/auth";
import { pocketbase } from "@/api/client";
import type { TenantSettings } from "@/api/tenant-settings";
import { tenantSettingsKeys } from "@/api/query-keys";
import { useUpdateTenantSettingsMutation } from "./use-tenant-settings";

const settings: TenantSettings = {
  id: "settings-1",
  tenant: "tenant-id",
  site_title: "Asset Calendar",
  booking_lock_hours: 24,
  created: "2026-01-01T00:00:00Z",
  updated: "2026-01-01T00:00:00Z",
};

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  queryClient.setQueryData(tenantSettingsKeys.current("tenant-id"), settings);
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

it("optimistically updates settings and rolls back a failed update", async () => {
  const error = Object.assign(new Error("Rejected"), { status: 400 });
  let rejectUpdate!: (reason: unknown) => void;
  const update = vi.fn().mockReturnValue(
    new Promise<never>((_resolve, reject) => {
      rejectUpdate = reject;
    }),
  );
  vi.spyOn(pocketbase, "collection").mockReturnValue({ update } as never);
  const { queryClient, wrapper } = setup();
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const { result } = renderHook(() => useUpdateTenantSettingsMutation(), { wrapper });

  let mutation!: Promise<unknown>;
  await act(async () => {
    mutation = result.current.mutateAsync({
      id: settings.id,
      input: { siteTitle: "Workshop", bookingLockHours: 12 },
    });
    await Promise.resolve();
  });
  expect(queryClient.getQueryData<TenantSettings>(tenantSettingsKeys.current("tenant-id"))).toEqual(
    {
      ...settings,
      site_title: "Workshop",
      booking_lock_hours: 12,
    },
  );

  rejectUpdate(error);
  await expect(mutation).rejects.toMatchObject({ kind: "validation" });
  expect(queryClient.getQueryData(tenantSettingsKeys.current("tenant-id"))).toEqual(settings);
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: tenantSettingsKeys.current("tenant-id"),
  });
});
