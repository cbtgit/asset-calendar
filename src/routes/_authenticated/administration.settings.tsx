import { createFileRoute } from "@tanstack/react-router";
import { TenantSettingsForm } from "@/components/administration/settings/tenant-settings-form";
import { Loading } from "@/components/base/Loading";
import { useTenantSettingsQuery } from "@/hooks/use-tenant-settings";

export const Route = createFileRoute("/_authenticated/administration/settings")({
  component: TenantSettingsPage,
});

function TenantSettingsPage() {
  const settings = useTenantSettingsQuery();

  if (settings.isPending) return <Loading className="loading-page" />;
  if (settings.error) {
    return <p role="alert">Unable to load tenant settings: {settings.error.message}</p>;
  }

  return <TenantSettingsForm settings={settings.data} />;
}
