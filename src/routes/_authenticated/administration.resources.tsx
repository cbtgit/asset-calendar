import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/administration/resources")({
  component: AdministrationResourcesPage,
});

function AdministrationResourcesPage() {
  return <Outlet />;
}
