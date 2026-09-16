import { getAuthSnapshot } from "./auth";
import { pocketbase } from "./client";
import { toAppError } from "./errors";

export type BillingRecord = {
  start: string;
  end: string;
  duration_hours: string;
  booker: string;
  group: string;
  resource: string;
  booking_type: string;
  amount: string;
};

export type BillingGroup = {
  name: string;
  records: BillingRecord[];
  total: string;
};

export type BillingPreview = {
  start: string;
  end: string;
  groups: BillingGroup[];
  total: string;
};

export type BillingInterval = {
  start: string;
  end: string;
};

function query(interval: BillingInterval, format?: "csv"): string {
  const params = new URLSearchParams({ start: interval.start, end: interval.end });
  if (format) params.set("format", format);
  return params.toString();
}

function assertAdministrator(): void {
  if (getAuthSnapshot().user?.role !== "administrator") {
    throw new Error("Billing exports require an administrator.");
  }
}

export async function searchBilling(interval: BillingInterval): Promise<BillingPreview> {
  assertAdministrator();
  try {
    return await pocketbase.send<BillingPreview>(`/api/billing/export?${query(interval)}`, {
      method: "GET",
    });
  } catch (cause) {
    throw toAppError(cause);
  }
}

export async function downloadBillingCsv(interval: BillingInterval): Promise<Blob> {
  assertAdministrator();
  try {
    const response = await fetch(
      `${pocketbase.baseURL}/api/billing/export?${query(interval, "csv")}`,
      { headers: { Authorization: pocketbase.authStore.token } },
    );
    if (!response.ok) {
      const error = new Error("PocketBase could not complete the request.");
      Object.assign(error, { status: response.status });
      throw error;
    }
    return await response.blob();
  } catch (cause) {
    throw toAppError(cause);
  }
}
