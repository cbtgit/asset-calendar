import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAuthSnapshot, isAdministrator } from "@/api/auth";

export const Route = createFileRoute("/_authenticated/resources")({
  beforeLoad: () => {
    if (!isAdministrator(getAuthSnapshot().user)) throw redirect({ to: "/calendar" });
  },
  component: () => <Outlet />,
});
