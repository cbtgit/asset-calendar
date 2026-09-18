import { expect, it } from "vite-plus/test";
import { bookingTypesQueryOptions } from "./booking-types";
import { groupsQueryOptions } from "./groups";
import { resourcesQueryOptions } from "./resources";
import { usersQueryOptions } from "./users";

it("uses a shared freshness window for administrative list queries", () => {
  const staleTimes = [
    usersQueryOptions().staleTime,
    groupsQueryOptions().staleTime,
    resourcesQueryOptions().staleTime,
    bookingTypesQueryOptions().staleTime,
  ];

  expect(staleTimes).toEqual([30 * 1000, 30 * 1000, 30 * 1000, 30 * 1000]);
});
