import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAuthSnapshot, isAdministrator } from "@/api/auth";

export const Route = createFileRoute("/_authenticated/administration")({
  beforeLoad: async () => {
    if (!isAdministrator(getAuthSnapshot().user)) {
      throw redirect({ to: "/calendar" });
    }
  },
  component: AdministrationPage,
});

function AdministrationPage() {
  return <Outlet />;
}
