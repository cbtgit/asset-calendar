import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  archiveBookingType,
  bookingTypeQueryOptions,
  bookingTypeSelectionQueryOptions,
  bookingTypesQueryOptions,
  createBookingType,
  updateBookingType,
  type BookingType,
  type BookingTypeUpdate,
} from "@/api/booking-types";
import { bookingTypesKeys } from "@/api/query-keys";

type BookingTypeSnapshots = {
  list: BookingType[] | undefined;
  selection: BookingType[] | undefined;
  detail: BookingType | undefined;
};

function sorted(items: BookingType[]): BookingType[] {
  return [...items].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
  );
}

async function snapshot(queryClient: ReturnType<typeof useQueryClient>, id?: string) {
  await queryClient.cancelQueries({ queryKey: bookingTypesKeys.all });
  return {
    list: queryClient.getQueryData<BookingType[]>(bookingTypesKeys.list()),
    selection: queryClient.getQueryData<BookingType[]>(bookingTypesKeys.selection()),
    detail: id ? queryClient.getQueryData<BookingType>(bookingTypesKeys.detail(id)) : undefined,
  };
}

function restore(queryClient: ReturnType<typeof useQueryClient>, previous: BookingTypeSnapshots) {
  queryClient.setQueryData(bookingTypesKeys.list(), previous.list);
  queryClient.setQueryData(bookingTypesKeys.selection(), previous.selection);
  if (previous.detail) {
    queryClient.setQueryData(bookingTypesKeys.detail(previous.detail.id), previous.detail);
  }
}

export function useBookingTypesQuery() {
  return useQuery(bookingTypesQueryOptions());
}

export function useBookingTypeSelectionQuery() {
  return useQuery(bookingTypeSelectionQueryOptions());
}

export function useBookingTypeQuery(id: string) {
  return useQuery(bookingTypeQueryOptions(id));
}

export function useCreateBookingTypeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createBookingType,
    onMutate: async (input): Promise<BookingTypeSnapshots> => {
      const previous = await snapshot(queryClient);
      const now = new Date().toISOString();
      const item: BookingType = {
        id: `optimistic-${crypto.randomUUID()}`,
        name: input.name.trim(),
        surcharge_minor_units: input.surcharge_minor_units,
        system_kind: input.system_kind,
        billable: input.billable ?? true,
        resource_blocking: input.resource_blocking ?? true,
        archived: false,
      };
      queryClient.setQueryData<BookingType[]>(bookingTypesKeys.list(), (items) =>
        items ? sorted([...items, { ...item, updated: now } as BookingType]) : items,
      );
      return previous;
    },
    onError: (_error, _input, previous) => previous && restore(queryClient, previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: bookingTypesKeys.all }),
  });
}

export function useUpdateBookingTypeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: BookingTypeUpdate }) =>
      updateBookingType(id, input),
    onMutate: async ({ id, input }): Promise<BookingTypeSnapshots> => {
      const previous = await snapshot(queryClient, id);
      const patch = { ...input, ...(input.name ? { name: input.name.trim() } : {}) };
      queryClient.setQueryData<BookingType[]>(bookingTypesKeys.list(), (items) =>
        items
          ? sorted(items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
          : items,
      );
      queryClient.setQueryData<BookingType[]>(bookingTypesKeys.selection(), (items) =>
        items
          ?.map((item) => (item.id === id ? { ...item, ...patch } : item))
          .filter((item) => !item.archived),
      );
      queryClient.setQueryData<BookingType>(bookingTypesKeys.detail(id), (item) =>
        item ? { ...item, ...patch } : item,
      );
      return previous;
    },
    onError: (_error, _input, previous) => previous && restore(queryClient, previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: bookingTypesKeys.all }),
  });
}

export function useArchiveBookingTypeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: archiveBookingType,
    onMutate: async (id): Promise<BookingTypeSnapshots> => {
      const previous = await snapshot(queryClient, id);
      queryClient.setQueryData<BookingType[]>(bookingTypesKeys.list(), (items) =>
        items?.map((item) => (item.id === id ? { ...item, archived: true } : item)),
      );
      queryClient.setQueryData<BookingType[]>(bookingTypesKeys.selection(), (items) =>
        items?.filter((item) => item.id !== id),
      );
      queryClient.setQueryData<BookingType>(bookingTypesKeys.detail(id), (item) =>
        item ? { ...item, archived: true } : item,
      );
      return previous;
    },
    onError: (_error, _input, previous) => previous && restore(queryClient, previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: bookingTypesKeys.all }),
  });
}
