import { queryOptions } from "@tanstack/react-query";
import type { RecordModel } from "pocketbase";
import { pocketbase } from "./client.ts";
import { toAppError } from "./errors.ts";
import { groupsKeys } from "./query-keys.ts";

export type Group = {
  id: string;
  name: string;
  created: string;
  updated: string;
  member_count: number;
};

export type GroupCreate = {
  name: string;
};

export type GroupRename = {
  name: string;
};

type OrganizationalUnitRecord = RecordModel & {
  name: string;
};

type GroupsProjectionResponse = {
  items: Group[];
};

function records() {
  return pocketbase.collection<OrganizationalUnitRecord>("organizational_units");
}

export async function getGroups(): Promise<Group[]> {
  try {
    const result = await pocketbase.send<GroupsProjectionResponse>("/api/groups", {
      method: "GET",
    });
    return result.items;
  } catch (cause) {
    throw toAppError(cause);
  }
}

export async function getGroup(id: string): Promise<Group> {
  try {
    return await pocketbase.send<Group>(`/api/groups/${id}`, { method: "GET" });
  } catch (cause) {
    throw toAppError(cause);
  }
}

export async function createGroup(input: GroupCreate): Promise<Group> {
  try {
    const record = await records().create(input);
    return await getGroup(record.id);
  } catch (cause) {
    throw toAppError(cause);
  }
}

export async function renameGroup(id: string, input: GroupRename): Promise<Group> {
  try {
    await records().update(id, input);
    return await getGroup(id);
  } catch (cause) {
    throw toAppError(cause);
  }
}

export async function deleteGroup(id: string): Promise<void> {
  try {
    await records().delete(id);
  } catch (cause) {
    throw toAppError(cause);
  }
}

export function groupsQueryOptions() {
  return queryOptions<Group[]>({
    queryKey: groupsKeys.list(),
    queryFn: getGroups,
  });
}
