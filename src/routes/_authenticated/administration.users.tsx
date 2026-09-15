import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/administration/users")({
  component: AdministrationUsersPage,
});

function AdministrationUsersPage() {
  return <Outlet />;
}
