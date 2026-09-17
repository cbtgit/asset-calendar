import { queryOptions } from "@tanstack/react-query";
import type { RecordModel } from "pocketbase";
import { pocketbase } from "./client";
import { toAppError } from "./errors";
import { tenantSettingsKeys } from "./query-keys";

export const TENANT_CURRENCIES = ["DKK", "EUR", "USD", "GBP"] as const;
export type TenantCurrency = (typeof TENANT_CURRENCIES)[number];

export const TENANT_TIME_ZONES = [
  "Europe/Copenhagen",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "UTC",
] as const;
export type TenantTimeZone = (typeof TENANT_TIME_ZONES)[number];

export type TenantSettings = RecordModel & {
  tenant: string;
  locale: string;
  currency_code: TenantCurrency;
  timezone: TenantTimeZone;
  booking_edit_lead_hours: number;
  heading_title: string;
};

export type TenantSettingsUpdate = {
  locale: string;
  currency_code: TenantCurrency;
  timezone: TenantTimeZone;
  booking_edit_lead_hours: number;
  heading_title: string;
};

function records() {
  return pocketbase.collection<TenantSettings>("tenant_settings");
}

export async function getTenantSettings(): Promise<TenantSettings> {
  try {
    const result = await records().getList(1, 1, { sort: "id" });
    const record = result.items[0];
    if (!record) throw new Error("PocketBase returned no tenant settings record.");
    return record;
  } catch (cause) {
    throw toAppError(cause);
  }
}

export async function updateTenantSettings(
  id: string,
  input: TenantSettingsUpdate,
): Promise<TenantSettings> {
  try {
    return await records().update(id, input);
  } catch (cause) {
    throw toAppError(cause);
  }
}

export function tenantSettingsQueryOptions() {
  return queryOptions<TenantSettings>({
    queryKey: tenantSettingsKeys.current(),
    queryFn: getTenantSettings,
  });
}
