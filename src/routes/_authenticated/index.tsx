import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/")({
  beforeLoad: () => {
    throw redirect({
      to: "/calendar",
      search: { date: "", view: "week", resource: "" },
    });
  },
});
