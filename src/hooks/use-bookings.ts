import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  calendarBookingsQueryOptions,
  createBooking,
  type BookingCreate,
  type CalendarBooking,
  type BookingRange,
} from "@/api/bookings";
import { getAuthSnapshot } from "@/api/auth";
import { bookingsKeys } from "@/api/query-keys";

type BookingsContext = {
  previousQueries: Array<[readonly unknown[], CalendarBooking[] | undefined]>;
};

function displayName(): string {
  const user = getAuthSnapshot().user;
  return [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.email || "User";
}

function optimisticBooking(input: BookingCreate): CalendarBooking {
  return {
    id: `optimistic-${crypto.randomUUID()}`,
    resource: input.resource,
    start: input.start,
    end: input.end,
    booker_display_name: displayName(),
    booking_type: input.booking_type ?? null,
    booking_type_name: null,
    booked_for_user: input.booked_for_user ?? getAuthSnapshot().user?.id,
    created_by_user: getAuthSnapshot().user?.id,
  };
}

function overlaps(leftStart: string, leftEnd: string, rightStart: string, rightEnd: string) {
  return new Date(leftStart) < new Date(rightEnd) && new Date(leftEnd) > new Date(rightStart);
}

function isVisibleQuery(
  queryKey: readonly unknown[],
): queryKey is readonly ["bookings", "visible", string, string, string] {
  return queryKey[0] === "bookings" && queryKey[1] === "visible";
}

export function useBookingsQuery(range: BookingRange) {
  return useQuery(calendarBookingsQueryOptions(range));
}

export function useCreateBookingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createBooking,
    onMutate: async (input): Promise<BookingsContext> => {
      await queryClient.cancelQueries({ queryKey: bookingsKeys.all });
      const previousQueries = queryClient.getQueriesData<CalendarBooking[]>({
        queryKey: bookingsKeys.all,
      });
      const optimistic = optimisticBooking(input);

      for (const [queryKey, bookings] of previousQueries) {
        if (!bookings || !isVisibleQuery(queryKey)) continue;
        const [, , resourceId, rangeStart, rangeEnd] = queryKey;
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
