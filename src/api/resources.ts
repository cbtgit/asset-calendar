import { queryOptions } from "@tanstack/react-query";
import type { RecordModel } from "pocketbase";
import { pocketbase } from "./client";
import { toAppError } from "./errors";
import { resourcesKeys } from "./query-keys";
import { ADMIN_LIST_STALE_TIME } from "./query-config";

export type Resource = {
  id: string;
  tenant: string;
  name: string;
  name_normalized: string;
  base_rate_minor_units: number;
  priority_booking_enabled: boolean;
  public_booking_release_weekday: number;
  public_booking_release_time: string;
  archived_at: string;
  created: string;
  updated: string;
};

export type ResourceCreate = {
  name: string;
  baseRateMinorUnits?: number;
  priorityBookingEnabled?: boolean;
  publicBookingReleaseWeekday?: number;
  publicBookingReleaseTime?: string;
};

export type ResourceUpdate = ResourceCreate;

type ResourceRecord = RecordModel & Resource;

type ResourcePayload = {
  name: string;
  base_rate_minor_units: number;
  priority_booking_enabled: boolean;
  public_booking_release_weekday: number;
  public_booking_release_time: string;
};

function records() {
  return pocketbase.collection<ResourceRecord>("resources");
}

export async function getResources(): Promise<Resource[]> {
  try {
    return await records().getFullList({ sort: "name" });
  } catch (cause) {
    throw toAppError(cause);
  }
}

export async function getResource(id: string): Promise<Resource> {
  try {
    return await records().getOne(id);
  } catch (cause) {
    throw toAppError(cause);
  }
}

export function resourcesQueryOptions() {
  return queryOptions<Resource[]>({
    queryKey: resourcesKeys.list(),
    queryFn: getResources,
    staleTime: ADMIN_LIST_STALE_TIME,
  });
}

export function resourceQueryOptions(id: string) {
  return queryOptions<Resource>({
    queryKey: resourcesKeys.detail(id),
    queryFn: () => getResource(id),
  });
}

function toResourcePayload(input: ResourceCreate): ResourcePayload {
  return {
    name: input.name.trim(),
    base_rate_minor_units: input.baseRateMinorUnits ?? 0,
    priority_booking_enabled: input.priorityBookingEnabled ?? false,
    public_booking_release_weekday: input.publicBookingReleaseWeekday ?? 3,
    public_booking_release_time: input.publicBookingReleaseTime ?? "10:00",
  };
}

export async function createResource(input: ResourceCreate): Promise<Resource> {
  try {
    return await records().create(toResourcePayload(input));
  } catch (cause) {
    throw toAppError(cause);
  }
}

export async function updateResource(id: string, input: ResourceUpdate): Promise<Resource> {
  try {
    return await records().update(id, toResourcePayload(input));
  } catch (cause) {
    throw toAppError(cause);
  }
}
