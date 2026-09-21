import type { RecordModel } from "pocketbase";
import { pocketbase } from "./client.ts";
import { toAppError } from "./errors.ts";
import { queryOptions } from "@tanstack/react-query";
import { bookingTypesKeys } from "./query-keys.ts";
import { getAuthSnapshot } from "./auth.ts";
import { ADMIN_LIST_STALE_TIME } from "./query-config.ts";

export const BOOKING_TYPE_COLORS = [
  { value: "#3E7D98", label: "Teal" },
  { value: "#168C6C", label: "Green" },
  { value: "#CF7B36", label: "Orange" },
  { value: "#B42318", label: "Red" },
  { value: "#52606D", label: "Slate" },
  { value: "#7A5C00", label: "Gold" },
] as const;

export const DEFAULT_BOOKING_TYPE_COLOR = BOOKING_TYPE_COLORS[0].value;

export type BookingTypeColor = (typeof BOOKING_TYPE_COLORS)[number]["value"];

export type BookingType = {
  id: string;
  tenant: string;
  name: string;
  name_normalized: string;
  surcharge_minor_units: number;
  nonbillable: boolean;
  color: BookingTypeColor | null;
  archived_at: string;
  created: string;
  updated: string;
};

export type BookingTypeCreate = {
  name: string;
  surchargeMinorUnits?: number;
  nonbillable?: boolean;
  color?: BookingTypeColor | null;
};

export type BookingTypeUpdate = BookingTypeCreate;

type BookingTypeRecord = RecordModel & BookingType;

type BookingTypePayload = {
  tenant: string;
  name: string;
  surcharge_minor_units: number;
  nonbillable: boolean;
  color: BookingTypeColor | null;
};

function records() {
  return pocketbase.collection<BookingTypeRecord>("booking_types");
}

export async function getBookingTypes(): Promise<BookingType[]> {
  try {
    return await records().getFullList({
      sort: "name",
    });
  } catch (cause) {
    throw toAppError(cause);
  }
}

export async function getBookingType(id: string): Promise<BookingType> {
  try {
    return await records().getOne(id);
  } catch (cause) {
    throw toAppError(cause);
  }
}

export function bookingTypesQueryOptions() {
  return queryOptions<BookingType[]>({
    queryKey: bookingTypesKeys.list(),
    queryFn: getBookingTypes,
    staleTime: ADMIN_LIST_STALE_TIME,
  });
}

export function bookingTypeQueryOptions(id: string) {
  return queryOptions<BookingType>({
    queryKey: bookingTypesKeys.detail(id),
    queryFn: () => getBookingType(id),
  });
}

function toBookingTypePayload(input: BookingTypeCreate, tenant: string): BookingTypePayload {
  const name = input.name.trim();

  return {
    tenant,
    name,
    surcharge_minor_units: input.surchargeMinorUnits ?? 0,
    nonbillable: input.nonbillable ?? false,
    color: input.color ?? null,
  };
}

export async function createBookingType(input: BookingTypeCreate): Promise<BookingType> {
  const tenant = getAuthSnapshot().user?.tenant;

  if (!tenant) {
    throw new Error("Cannot create a booking type without an authenticated tenant.");
  }

  try {
    return await records().create(toBookingTypePayload(input, tenant));
  } catch (cause) {
    throw toAppError(cause);
  }
}

export async function updateBookingType(
  id: string,
  input: BookingTypeUpdate,
): Promise<BookingType> {
  try {
    return await records().update(id, {
      name: input.name.trim(),
      surcharge_minor_units: input.surchargeMinorUnits ?? 0,
      nonbillable: input.nonbillable ?? false,
      color: input.color ?? null,
    });
  } catch (cause) {
    throw toAppError(cause);
  }
}
