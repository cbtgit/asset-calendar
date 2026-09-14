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
type BookingTypeMutationContext = BookingTypeSnapshot & {
  keys: BookingTypeQueryKeys;
  release: MutationRelease;
};

const mutationQueue = createMutationQueue();
const pendingMutations = new Map<string, number>();

function captureBookingTypeKeys() {
  const all = bookingTypesKeys.all;
  return {
    all,
    list: [...all, "list"] as const,
    selection: [...all, "selection"] as const,
    detail: (id: string) => [...all, "detail", id] as const,
  } as const;
}

type BookingTypeQueryKeys = ReturnType<typeof captureBookingTypeKeys>;

function sorted(items: BookingType[]): BookingType[] {
  return [...items].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
  );
}

async function snapshot(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
  keys: BookingTypeQueryKeys,
) {
  await queryClient.cancelQueries({ queryKey: keys.all });
  return {
    id,
    list: queryClient.getQueryData<BookingType[]>(keys.list)?.find((item) => item.id === id),
    selection: queryClient
      .getQueryData<BookingType[]>(keys.selection)
      ?.find((item) => item.id === id),
    detail: queryClient.getQueryData<BookingType>(keys.detail(id)),
    removeIfMissing: false,
  };
}

function restore(
  queryClient: ReturnType<typeof useQueryClient>,
  previous: BookingTypeSnapshot,
  keys: BookingTypeQueryKeys,
) {
  const previousList = previous.list;
  const previousSelection = previous.selection;
  queryClient.setQueryData<BookingType[]>(keys.list, (items) => {
    if (previousList) {
      if (!items) return items;
      return items.some((item) => item.id === previous.id)
        ? items.map((item) => (item.id === previous.id ? previousList : item))
        : sorted([...items, previousList]);
    }
    return previous.removeIfMissing ? items?.filter((item) => item.id !== previous.id) : items;
  });
  queryClient.setQueryData<BookingType[]>(keys.selection, (items) => {
    if (previousSelection) {
      if (!items) return items;
      return items.some((item) => item.id === previous.id)
        ? items.map((item) => (item.id === previous.id ? previousSelection : item))
        : sorted([...items, previousSelection]);
    }
    return previous.removeIfMissing ? items?.filter((item) => item.id !== previous.id) : items;
  });
  if (previous.detail) {
    queryClient.setQueryData(keys.detail(previous.id), previous.detail);
  }
}

function beginMutation(keys: BookingTypeQueryKeys) {
  const scope = keys.all[0];
  pendingMutations.set(scope, (pendingMutations.get(scope) ?? 0) + 1);
}

async function settleMutation(
  queryClient: ReturnType<typeof useQueryClient>,
  keys: BookingTypeQueryKeys,
  release: MutationRelease | undefined,
) {
  const scope = keys.all[0];
  const remaining = (pendingMutations.get(scope) ?? 1) - 1;
  if (remaining === 0) pendingMutations.delete(scope);
  else pendingMutations.set(scope, remaining);
  try {
    if (remaining === 0) {
      await queryClient.invalidateQueries({ queryKey: keys.all });
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
      const keys = captureBookingTypeKeys();
      const optimisticId = `optimistic-${crypto.randomUUID()}`;
      beginMutation(keys);
      const release = await mutationQueue.acquire(`${keys.all[0]}:${optimisticId}`);
      const previous = await snapshot(queryClient, optimisticId, keys);
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
      queryClient.setQueryData<BookingType[]>(keys.list, (items) =>
        items ? sorted([...items, { ...item, updated: now } as BookingType]) : items,
      );
      queryClient.setQueryData<BookingType[]>(keys.selection, (items) =>
        items ? sorted([...items, item]) : items,
      );
      return { ...previous, keys, release };
    },
    onError: (_error, _input, context) => context && restore(queryClient, context, context.keys),
    onSettled: (_data, _error, _input, context) =>
      context && settleMutation(queryClient, context.keys, context.release),
  });
}

export function useUpdateBookingTypeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: BookingTypeUpdate }) =>
      updateBookingType(id, input),
    onMutate: async ({ id, input }): Promise<BookingTypeMutationContext> => {
      const keys = captureBookingTypeKeys();
      beginMutation(keys);
      const release = await mutationQueue.acquire(`${keys.all[0]}:${id}`);
      const previous = await snapshot(queryClient, id, keys);
      const patch = { ...input, ...(input.name ? { name: input.name.trim() } : {}) };
      queryClient.setQueryData<BookingType[]>(keys.list, (items) =>
        items
          ? sorted(items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
          : items,
      );
      queryClient.setQueryData<BookingType[]>(keys.selection, (items) =>
        items
          ?.map((item) => (item.id === id ? { ...item, ...patch } : item))
          .filter((item) => !item.archived),
      );
      queryClient.setQueryData<BookingType>(keys.detail(id), (item) =>
        item ? { ...item, ...patch } : item,
      );
      return { ...previous, keys, release };
    },
    onError: (_error, _input, context) => context && restore(queryClient, context, context.keys),
    onSettled: (_data, _error, _input, context) =>
      context && settleMutation(queryClient, context.keys, context.release),
  });
}

export function useArchiveBookingTypeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: archiveBookingType,
    onMutate: async (id): Promise<BookingTypeMutationContext> => {
      const keys = captureBookingTypeKeys();
      beginMutation(keys);
      const release = await mutationQueue.acquire(`${keys.all[0]}:${id}`);
      const previous = await snapshot(queryClient, id, keys);
      queryClient.setQueryData<BookingType[]>(keys.list, (items) =>
        items?.map((item) => (item.id === id ? { ...item, archived: true } : item)),
      );
      queryClient.setQueryData<BookingType[]>(keys.selection, (items) =>
        items?.filter((item) => item.id !== id),
      );
      queryClient.setQueryData<BookingType>(keys.detail(id), (item) =>
        item ? { ...item, archived: true } : item,
      );
      return { ...previous, keys, release };
    },
    onError: (_error, _input, context) => context && restore(queryClient, context, context.keys),
    onSettled: (_data, _error, _input, context) =>
      context && settleMutation(queryClient, context.keys, context.release),
  });
}
