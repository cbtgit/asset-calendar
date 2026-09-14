import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuthSnapshot, isAdministrator } from "@/api/auth";
import { TenantSettingsForm } from "@/components/tenant-settings-form";

export const Route = createFileRoute("/_authenticated/settings")({
  beforeLoad: () => {
    if (!isAdministrator(getAuthSnapshot().user)) throw redirect({ to: "/calendar" });
  },
  component: SettingsPage,
});

function SettingsPage() {
  return <TenantSettingsForm />;
}
