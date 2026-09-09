import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/setup")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/setup-password", search });
  },
});
