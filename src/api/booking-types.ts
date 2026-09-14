import { queryOptions } from "@tanstack/react-query";
import type { RecordModel } from "pocketbase";
import { pocketbase } from "./client.ts";
import { toAppError } from "./errors.ts";
import { bookingTypesKeys } from "./query-keys.ts";

export const systemKinds = ["regular", "training", "maintenance", "custom"] as const;
export type SystemKind = (typeof systemKinds)[number];

export type BookingType = {
  id: string;
  name: string;
  system_kind: SystemKind;
  surcharge_minor_units: number;
  billable: boolean;
  resource_blocking: boolean;
  archived: boolean;
  archived_at?: string;
};

export type BookingTypeCreate = {
  name: string;
  surcharge_minor_units: number;
  system_kind: "custom";
  billable?: boolean;
  resource_blocking?: boolean;
};
export type BookingTypeUpdate = Partial<Omit<BookingTypeCreate, "system_kind">> & {
  archived?: boolean;
};
export type BookingTypeSelection = BookingType;

type BookingTypeRecord = RecordModel &
  BookingTypeCreate & { archived: boolean; archived_at?: string };
type BookingTypeListResponse = { items: BookingType[] };

function records() {
  return pocketbase.collection<BookingTypeRecord>("booking_types");
}

async function getProjection<T>(path: string): Promise<T> {
  try {
    return await pocketbase.send<T>(path, { method: "GET" });
  } catch (cause) {
    throw toAppError(cause);
  }
}

export async function getBookingTypes(): Promise<BookingType[]> {
  return (await getProjection<BookingTypeListResponse>("/api/booking-types")).items;
}

export async function getBookingTypeSelection(): Promise<BookingTypeSelection[]> {
  return (await getProjection<{ items: BookingTypeSelection[] }>("/api/booking-types/selection"))
    .items;
}

export async function getBookingType(id: string): Promise<BookingType> {
  return getProjection<BookingType>(`/api/booking-types/${id}`);
}

export async function createBookingType(input: BookingTypeCreate): Promise<BookingType> {
  try {
    const record = await records().create(input);
    return await getBookingType(record.id);
  } catch (cause) {
    throw toAppError(cause);
  }
}

export async function updateBookingType(
  id: string,
  input: BookingTypeUpdate,
): Promise<BookingType> {
  try {
    await records().update(id, input);
    return await getBookingType(id);
  } catch (cause) {
    throw toAppError(cause);
  }
}

export async function archiveBookingType(id: string): Promise<BookingType> {
  return updateBookingType(id, { archived: true });
}

export function bookingTypesQueryOptions() {
  return queryOptions<BookingType[]>({
    queryKey: bookingTypesKeys.list(),
    queryFn: getBookingTypes,
  });
}

export function bookingTypeSelectionQueryOptions() {
  return queryOptions<BookingTypeSelection[]>({
    queryKey: bookingTypesKeys.selection(),
    queryFn: getBookingTypeSelection,
  });
}

export function bookingTypeQueryOptions(id: string) {
  return queryOptions<BookingType>({
    queryKey: bookingTypesKeys.detail(id),
    queryFn: () => getBookingType(id),
  });
}
