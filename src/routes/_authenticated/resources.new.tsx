import { createFileRoute } from "@tanstack/react-router";
import { ResourceForm } from "@/components/resource-form";
import { useTenantSettingsQuery } from "@/hooks/use-tenant-settings";

export const Route = createFileRoute("/_authenticated/resources/new")({
  component: NewResourcePage,
});

function NewResourcePage() {
  const settings = useTenantSettingsQuery();
  if (settings.isPending) return <p role="status">Loading tenant settings…</p>;
  if (settings.isError)
    return <p role="alert">We could not load tenant settings: {settings.error.message}</p>;
  return <ResourceForm locale={settings.data.locale} currency={settings.data.currency} />;
}
