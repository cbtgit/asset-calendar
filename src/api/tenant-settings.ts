import { queryOptions } from "@tanstack/react-query";
import type { RecordModel } from "pocketbase";
import { pocketbase } from "./client.ts";
import { toAppError } from "./errors.ts";
import { tenantSettingsKeys } from "./query-keys.ts";

export const currencies = ["DKK", "EUR", "USD", "GBP"] as const;
export type Currency = (typeof currencies)[number];

export type TenantSettings = {
  id: string;
  currency: Currency;
  locale: string;
};

export type TenantSettingsUpdate = {
  locale: string;
};

type TenantRecord = RecordModel & {
  currency: Currency;
  locale: string;
};

function tenantId(): string {
  const id = pocketbase.authStore.record?.tenant;
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("An authenticated tenant is required.");
  }
  return id;
}

function project(record: TenantRecord): TenantSettings {
  return { id: record.id, currency: record.currency, locale: record.locale };
}

export async function getTenantSettings(): Promise<TenantSettings> {
  try {
    return project(await pocketbase.collection<TenantRecord>("tenants").getOne(tenantId()));
  } catch (cause) {
    throw toAppError(cause);
  }
}

export async function updateTenantSettings(input: TenantSettingsUpdate): Promise<TenantSettings> {
  try {
    return project(
      await pocketbase.collection<TenantRecord>("tenants").update(tenantId(), {
        locale: input.locale,
      }),
    );
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
