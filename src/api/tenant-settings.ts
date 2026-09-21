import { queryOptions } from "@tanstack/react-query";
import type { RecordModel } from "pocketbase";
import { pocketbase } from "./client";
import { toAppError } from "./errors";
import { tenantSettingsKeys } from "./query-keys";
import { getAuthSnapshot } from "./auth";

export type TenantSettings = {
  id: string;
  tenant: string;
  site_title: string;
  booking_lock_hours: number;
  created: string;
  updated: string;
};

export type TenantSettingsUpdate = {
  siteTitle: string;
  bookingLockHours: number;
};

type TenantSettingsRecord = RecordModel & TenantSettings;

function records() {
  return pocketbase.collection<TenantSettingsRecord>("tenant_settings");
}

export async function getTenantSettings(
  tenantId = getAuthSnapshot().user?.tenant,
): Promise<TenantSettings> {
  if (!tenantId) {
    throw new Error("Cannot load tenant settings without an authenticated tenant.");
  }

  try {
    return await records().getFirstListItem(
      pocketbase.filter("tenant = {:tenant}", { tenant: tenantId }),
    );
  } catch (cause) {
    throw toAppError(cause);
  }
}

export function tenantSettingsQueryOptions(tenantId: string) {
  return queryOptions<TenantSettings>({
    queryKey: tenantSettingsKeys.current(tenantId),
    queryFn: () => getTenantSettings(tenantId),
  });
}

export async function updateTenantSettings(
  id: string,
  input: TenantSettingsUpdate,
): Promise<TenantSettings> {
  try {
    return await records().update(id, {
      site_title: input.siteTitle.trim(),
      booking_lock_hours: input.bookingLockHours,
    });
  } catch (cause) {
    throw toAppError(cause);
  }
}
