import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/administration/groups")({
  component: AdministrationGroupsPage,
});

function AdministrationGroupsPage() {
  return <Outlet />;
}
