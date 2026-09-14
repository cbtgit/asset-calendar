import { queryOptions } from "@tanstack/react-query";
import type { RecordModel } from "pocketbase";
import { getAuthSnapshot, isAdministrator } from "./auth";
import { pocketbase } from "./client.ts";
import { toAppError } from "./errors.ts";
import { resourcesKeys } from "./query-keys.ts";

export type Resource = {
  id: string;
  name: string;
  created: string;
  updated: string;
  archived: boolean;
  archived_at?: string;
  base_rate_minor_units: number;
};
export type AdministratorResource = Resource;

export type ActiveResource = Omit<Resource, "base_rate_minor_units" | "archived_at">;
export type ResourceCreate = {
  name: string;
  base_rate_minor_units: number;
  archived?: false;
};
export type ResourceUpdate = Omit<ResourceCreate, "archived">;

type ResourceRecord = RecordModel & ResourceCreate & { archived: boolean; archived_at?: string };
type ResourceListResponse<T> = { items: T[] };

function records() {
  return pocketbase.collection<ResourceRecord>("resources");
}

async function getProjection<T>(path: string): Promise<T> {
  try {
    return await pocketbase.send<T>(path, { method: "GET" });
  } catch (cause) {
    throw toAppError(cause);
  }
}

function requireAdministratorProjection() {
  const user = getAuthSnapshot().user;
  if (!user || !isAdministrator(user)) {
    throw new Error("Administrator authorization is required for resource rates.");
  }
}

export async function getResources(): Promise<AdministratorResource[]> {
  requireAdministratorProjection();
  const response =
    await getProjection<ResourceListResponse<AdministratorResource>>("/api/resources");
  return response.items;
}

export async function getActiveResources(): Promise<ActiveResource[]> {
  const response =
    await getProjection<ResourceListResponse<ActiveResource>>("/api/resources/active");
  return response.items;
}

export async function getResource(id: string): Promise<AdministratorResource> {
  requireAdministratorProjection();
  return getProjection<AdministratorResource>(`/api/resources/${id}`);
}

export async function createResource(input: ResourceCreate): Promise<Resource> {
  try {
    const record = await records().create({ ...input, archived: false });
    return await getResource(record.id);
  } catch (cause) {
    throw toAppError(cause);
  }
}

export async function updateResource(id: string, input: ResourceUpdate): Promise<Resource> {
  try {
    await records().update(id, input);
    return await getResource(id);
  } catch (cause) {
    throw toAppError(cause);
  }
}

export async function archiveResource(id: string): Promise<Resource> {
  try {
    await records().update(id, { archived: true });
    return await getResource(id);
  } catch (cause) {
    throw toAppError(cause);
  }
}

export function resourcesQueryOptions() {
  return queryOptions<AdministratorResource[]>({
    queryKey: resourcesKeys.list(),
    queryFn: getResources,
  });
}

export function activeResourcesQueryOptions() {
  return queryOptions<ActiveResource[]>({
    queryKey: resourcesKeys.active(),
    queryFn: getActiveResources,
  });
}

export function resourceQueryOptions(id: string) {
  return queryOptions<AdministratorResource>({
    queryKey: resourcesKeys.detail(id),
    queryFn: () => getResource(id),
  });
}
