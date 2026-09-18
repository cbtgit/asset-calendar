import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  bookingTypesQueryOptions,
  createBookingType,
  updateBookingType,
  type BookingType,
  type BookingTypeCreate,
  type BookingTypeUpdate,
} from "@/api/booking-types";
import { bookingTypesKeys } from "@/api/query-keys";
import { getAuthSnapshot } from "@/api/auth";

type BookingTypesContext = {
  previousBookingTypes: BookingType[] | undefined;
};

function optimisticBookingType(input: BookingTypeCreate): BookingType {
  const now = new Date().toISOString();
  const name = input.name.trim();
  return {
    id: `optimistic-${crypto.randomUUID()}`,
    tenant: getAuthSnapshot().user?.tenant ?? "",
    name,
    name_normalized: name.toLowerCase(),
    surcharge_minor_units: input.nonbillable ? 0 : (input.surchargeMinorUnits ?? 0),
    nonbillable: input.nonbillable ?? false,
    color: input.color ?? null,
    archived_at: "",
    created: now,
    updated: now,
  };
}

function sortBookingTypes(bookingTypes: BookingType[]): BookingType[] {
  return [...bookingTypes].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
  );
}

export function useBookingTypesQuery() {
  return useQuery(bookingTypesQueryOptions());
}

export function useCreateBookingTypeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createBookingType,
    onMutate: async (input): Promise<BookingTypesContext> => {
      await queryClient.cancelQueries({ queryKey: bookingTypesKeys.list() });
      const previousBookingTypes = queryClient.getQueryData<BookingType[]>(bookingTypesKeys.list());
      if (previousBookingTypes) {
        queryClient.setQueryData(
          bookingTypesKeys.list(),
          sortBookingTypes([...previousBookingTypes, optimisticBookingType(input)]),
        );
      }
      return { previousBookingTypes };
    },
    onError: (_error, _input, context) => {
      if (context?.previousBookingTypes !== undefined) {
        queryClient.setQueryData(bookingTypesKeys.list(), context.previousBookingTypes);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: bookingTypesKeys.list() }),
  });
}

export function useUpdateBookingTypeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: BookingTypeUpdate }) =>
      updateBookingType(id, input),
    onMutate: async ({ id, input }): Promise<BookingTypesContext> => {
      await queryClient.cancelQueries({ queryKey: bookingTypesKeys.list() });
      const previousBookingTypes = queryClient.getQueryData<BookingType[]>(bookingTypesKeys.list());
      queryClient.setQueryData<BookingType[]>(bookingTypesKeys.list(), (bookingTypes) =>
        bookingTypes
          ? sortBookingTypes(
              bookingTypes.map((bookingType) =>
                bookingType.id === id
                  ? {
                      ...bookingType,
                      name: input.name.trim(),
                      name_normalized: input.name.trim().toLowerCase(),
                      surcharge_minor_units: input.surchargeMinorUnits ?? 0,
                      nonbillable: input.nonbillable ?? false,
                      color: input.color ?? null,
                    }
                  : bookingType,
              ),
            )
          : bookingTypes,
      );
      return { previousBookingTypes };
    },
    onError: (_error, _input, context) => {
      if (context?.previousBookingTypes !== undefined) {
        queryClient.setQueryData(bookingTypesKeys.list(), context.previousBookingTypes);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: bookingTypesKeys.list() }),
  });
}
