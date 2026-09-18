import { createFileRoute } from "@tanstack/react-router";
import { usersQueryOptions } from "@/api/users";
import { queryClient } from "@/lib/query-client";
import { UsersPage } from "./-users-page";

export const Route = createFileRoute("/_authenticated/administration/users/")({
  loader: () => {
    void queryClient.prefetchQuery(usersQueryOptions()).catch(() => undefined);
  },
  component: UsersPage,
});
