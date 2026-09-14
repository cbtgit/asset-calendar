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
import { createMutationQueue, type MutationRelease } from "@/lib/mutation-queue";

type BookingTypeSnapshot = {
  id: string;
  list: BookingType | undefined;
  selection: BookingType | undefined;
  detail: BookingType | undefined;
  removeIfMissing: boolean;
};
type BookingTypeMutationContext = BookingTypeSnapshot & { release: MutationRelease };

const mutationQueue = createMutationQueue();
let pendingMutations = 0;

function sorted(items: BookingType[]): BookingType[] {
  return [...items].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
  );
}

async function snapshot(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  await queryClient.cancelQueries({ queryKey: bookingTypesKeys.all });
  return {
    id,
    list: queryClient
      .getQueryData<BookingType[]>(bookingTypesKeys.list())
      ?.find((item) => item.id === id),
    selection: queryClient
      .getQueryData<BookingType[]>(bookingTypesKeys.selection())
      ?.find((item) => item.id === id),
    detail: queryClient.getQueryData<BookingType>(bookingTypesKeys.detail(id)),
    removeIfMissing: false,
  };
}

function restore(queryClient: ReturnType<typeof useQueryClient>, previous: BookingTypeSnapshot) {
  const previousList = previous.list;
  const previousSelection = previous.selection;
  queryClient.setQueryData<BookingType[]>(bookingTypesKeys.list(), (items) => {
    if (previousList) {
      if (!items) return items;
      return items.some((item) => item.id === previous.id)
        ? items.map((item) => (item.id === previous.id ? previousList : item))
        : sorted([...items, previousList]);
    }
    return previous.removeIfMissing ? items?.filter((item) => item.id !== previous.id) : items;
  });
  queryClient.setQueryData<BookingType[]>(bookingTypesKeys.selection(), (items) => {
    if (previousSelection) {
      if (!items) return items;
      return items.some((item) => item.id === previous.id)
        ? items.map((item) => (item.id === previous.id ? previousSelection : item))
        : sorted([...items, previousSelection]);
    }
    return previous.removeIfMissing ? items?.filter((item) => item.id !== previous.id) : items;
  });
  if (previous.detail) {
    queryClient.setQueryData(bookingTypesKeys.detail(previous.id), previous.detail);
  }
}

function beginMutation() {
  pendingMutations += 1;
}

async function settleMutation(
  queryClient: ReturnType<typeof useQueryClient>,
  release: MutationRelease | undefined,
) {
  pendingMutations -= 1;
  try {
    if (pendingMutations === 0) {
      await queryClient.invalidateQueries({ queryKey: bookingTypesKeys.all });
    }
  } finally {
    release?.();
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
    onMutate: async (input): Promise<BookingTypeMutationContext> => {
      const optimisticId = `optimistic-${crypto.randomUUID()}`;
      beginMutation();
      const release = await mutationQueue.acquire(optimisticId);
      const previous = await snapshot(queryClient, optimisticId);
      previous.removeIfMissing = true;
      const now = new Date().toISOString();
      const item: BookingType = {
        id: optimisticId,
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
      queryClient.setQueryData<BookingType[]>(bookingTypesKeys.selection(), (items) =>
        items ? sorted([...items, item]) : items,
      );
      return { ...previous, release };
    },
    onError: (_error, _input, context) => context && restore(queryClient, context),
    onSettled: (_data, _error, _input, context) => settleMutation(queryClient, context?.release),
  });
}

export function useUpdateBookingTypeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: BookingTypeUpdate }) =>
      updateBookingType(id, input),
    onMutate: async ({ id, input }): Promise<BookingTypeMutationContext> => {
      beginMutation();
      const release = await mutationQueue.acquire(id);
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
      return { ...previous, release };
    },
    onError: (_error, _input, context) => context && restore(queryClient, context),
    onSettled: (_data, _error, _input, context) => settleMutation(queryClient, context?.release),
  });
}

export function useArchiveBookingTypeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: archiveBookingType,
    onMutate: async (id): Promise<BookingTypeMutationContext> => {
      beginMutation();
      const release = await mutationQueue.acquire(id);
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
      return { ...previous, release };
    },
    onError: (_error, _input, context) => context && restore(queryClient, context),
    onSettled: (_data, _error, _input, context) => settleMutation(queryClient, context?.release),
  });
}
