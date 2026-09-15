import type { RecordModel } from "pocketbase";
import { pocketbase } from "./client.ts";
import { toAppError } from "./errors.ts";
import { queryOptions } from "@tanstack/react-query";
import { bookingTypesKeys } from "./query-keys.ts";
import { getAuthSnapshot } from "./auth.ts";

export type BookingType = {
  id: string;
  tenant: string;
  name: string;
  name_normalized: string;
  surcharge_minor_units: number;
  archived_at: string;
  created: string;
  updated: string;
};

export type BookingTypeCreate = {
  name: string;
  surchargeMinorUnits?: number;
};

export type BookingTypeUpdate = BookingTypeCreate;

type BookingTypeRecord = RecordModel & BookingType;

type BookingTypePayload = {
  tenant: string;
  name: string;
  surcharge_minor_units: number;
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
  });
}

function toBookingTypePayload(input: BookingTypeCreate, tenant: string): BookingTypePayload {
  const name = input.name.trim();

  return {
    tenant,
    name,
    surcharge_minor_units: input.surchargeMinorUnits ?? 0,
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
    });
  } catch (cause) {
    throw toAppError(cause);
  }
}
