import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  calendarBookingsQueryOptions,
  createBooking,
  deleteBooking,
  updateBooking,
  type BookingCreate,
  type BookingUpdate,
  type CalendarBooking,
  type BookingRange,
} from "@/api/bookings";
import { getAuthSnapshot } from "@/api/auth";
import { bookingsKeys } from "@/api/query-keys";

type BookingsContext = {
  previousQueries: Array<[readonly unknown[], CalendarBooking[] | undefined]>;
};

export type BookingUpdateMutationInput = BookingUpdate & {
  optimisticBooking?: CalendarBooking;
};

export type BookingCreateMutationInput = BookingCreate & {
  optimisticBookerDisplayName?: string;
  optimisticBookingTypeName?: string | null;
  optimisticBookingTypeColor?: string | null;
};

function displayName(): string {
  const user = getAuthSnapshot().user;
  return [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.email || "User";
}

function optimisticBooking(input: BookingCreateMutationInput): CalendarBooking {
  return {
    id: `optimistic-${crypto.randomUUID()}`,
    resource: input.resource,
    start: input.start,
    end: input.end,
    booker_display_name: input.optimisticBookerDisplayName ?? displayName(),
    booking_type: input.booking_type ?? null,
    booking_type_name: input.optimisticBookingTypeName ?? null,
    booking_type_color: input.optimisticBookingTypeColor ?? null,
    booked_for_user: input.booked_for_user ?? getAuthSnapshot().user?.id,
    created_by_user: getAuthSnapshot().user?.id,
  };
}

function overlaps(leftStart: string, leftEnd: string, rightStart: string, rightEnd: string) {
  return new Date(leftStart) < new Date(rightEnd) && new Date(leftEnd) > new Date(rightStart);
}

function isVisibleQuery(
  queryKey: readonly unknown[],
): queryKey is readonly ["bookings", "visible", string, string, string, string, string, string] {
  return queryKey[0] === "bookings" && queryKey[1] === "visible";
}

export function useBookingsQuery(range: BookingRange) {
  return useQuery(calendarBookingsQueryOptions(range));
}

export function useCreateBookingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      optimisticBookerDisplayName: _optimisticBookerDisplayName,
      optimisticBookingTypeName: _optimisticBookingTypeName,
      optimisticBookingTypeColor: _optimisticBookingTypeColor,
      ...input
    }: BookingCreateMutationInput) => createBooking(input),
    onMutate: async (input): Promise<BookingsContext> => {
      await queryClient.cancelQueries({ queryKey: bookingsKeys.all });
      const previousQueries = queryClient.getQueriesData<CalendarBooking[]>({
        queryKey: bookingsKeys.all,
      });
      const optimistic = optimisticBooking(input);

      for (const [queryKey, bookings] of previousQueries) {
        if (!bookings || !isVisibleQuery(queryKey)) continue;
        const [, , , , , resourceId, rangeStart, rangeEnd] = queryKey;
        if (
          resourceId === input.resource &&
          overlaps(input.start, input.end, rangeStart, rangeEnd)
        ) {
          queryClient.setQueryData(queryKey, [...bookings, optimistic]);
        }
      }

      return { previousQueries };
    },
    onError: (_error, _input, context) => {
      for (const [queryKey, data] of context?.previousQueries ?? []) {
        queryClient.setQueryData(queryKey, data);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: bookingsKeys.all });
    },
  });
}

function optimisticUpdatedBooking(
  current: CalendarBooking | undefined,
  input: BookingUpdateMutationInput,
): CalendarBooking | undefined {
  const booking = current ? { ...current, ...input.optimisticBooking } : input.optimisticBooking;
  if (!booking) return undefined;

  return {
    ...booking,
    start: input.start,
    end: input.end,
    ...(Object.prototype.hasOwnProperty.call(input, "booked_for_user")
      ? { booked_for_user: input.booked_for_user ?? undefined }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(input, "booking_type")
      ? {
          booking_type: input.booking_type ?? null,
          booking_type_name: input.optimisticBooking?.booking_type_name ?? null,
          booking_type_color: input.optimisticBooking?.booking_type_color ?? null,
        }
      : {}),
  };
}

export function useUpdateBookingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ optimisticBooking: _optimisticBooking, ...input }: BookingUpdateMutationInput) =>
      updateBooking(input),
    onMutate: async (input): Promise<BookingsContext> => {
      await queryClient.cancelQueries({ queryKey: bookingsKeys.all });
      const previousQueries = queryClient.getQueriesData<CalendarBooking[]>({
        queryKey: bookingsKeys.all,
      });

      for (const [queryKey, bookings] of previousQueries) {
        if (!bookings || !isVisibleQuery(queryKey)) continue;
        const [, , , , , resourceId, rangeStart, rangeEnd] = queryKey;
        const current = bookings.find((booking) => booking.id === input.id);
        const updated = optimisticUpdatedBooking(current, input);
        if (!updated) continue;

        const remainsVisible =
          updated.resource === resourceId &&
          overlaps(updated.start, updated.end, rangeStart, rangeEnd);
        const withoutCurrent = bookings.filter((booking) => booking.id !== input.id);
        queryClient.setQueryData(
          queryKey,
          remainsVisible ? [...withoutCurrent, updated] : withoutCurrent,
        );
      }

      return { previousQueries };
    },
    onError: (_error, _input, context) => {
      for (const [queryKey, data] of context?.previousQueries ?? []) {
        queryClient.setQueryData(queryKey, data);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: bookingsKeys.all });
    },
  });
}

export function useDeleteBookingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string }) => deleteBooking(id),
    onMutate: async ({ id }): Promise<BookingsContext> => {
      await queryClient.cancelQueries({ queryKey: bookingsKeys.all });
      const previousQueries = queryClient.getQueriesData<CalendarBooking[]>({
        queryKey: bookingsKeys.all,
      });

      for (const [queryKey, bookings] of previousQueries) {
        if (!bookings || !isVisibleQuery(queryKey)) continue;
        queryClient.setQueryData(
          queryKey,
          bookings.filter((booking) => booking.id !== id),
        );
      }

      return { previousQueries };
    },
    onError: (_error, _input, context) => {
      for (const [queryKey, data] of context?.previousQueries ?? []) {
        queryClient.setQueryData(queryKey, data);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: bookingsKeys.all });
    },
  });
}
