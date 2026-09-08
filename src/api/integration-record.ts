import { queryOptions } from "@tanstack/react-query";
import type { RecordModel } from "pocketbase";
import { pocketbase } from "./client.ts";
import { toAppError } from "./errors.ts";
import { integrationRecordKeys } from "./query-keys.ts";

export type IntegrationRecord = RecordModel & {
  title: string;
};

export type IntegrationRecordUpdate = {
  title: string;
};

function records() {
  return pocketbase.collection<IntegrationRecord>("integration_records");
}

export async function getIntegrationRecord(): Promise<IntegrationRecord> {
  try {
    const result = await records().getList<IntegrationRecord>(1, 1, {
      sort: "id",
    });
    const record = result.items[0];
    if (!record) throw new Error("PocketBase returned no integration record.");
    return record;
  } catch (cause) {
    throw toAppError(cause);
  }
}

export async function updateIntegrationRecord(
  id: string,
  update: IntegrationRecordUpdate,
): Promise<IntegrationRecord> {
  try {
    return await records().update<IntegrationRecord>(id, update);
  } catch (cause) {
    throw toAppError(cause);
  }
}

export function integrationRecordQueryOptions() {
  return queryOptions<IntegrationRecord>({
    queryKey: integrationRecordKeys.current(),
    queryFn: getIntegrationRecord,
    staleTime: Infinity,
  });
}
