import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ResourceForm } from "@/components/administration/resources/resource-form";
import { useTenantDisplaySettings } from "@/hooks/use-tenant-display-settings";

export const Route = createFileRoute("/_authenticated/administration/resources/new")({
  component: NewResourcePage,
});

function NewResourcePage() {
  const navigate = useNavigate();
  const settings = useTenantDisplaySettings();

  return (
    <ResourceForm
      locale={settings.locale}
      onCancel={() => void navigate({ to: "/administration/resources" })}
      onSuccess={() => void navigate({ to: "/administration/resources", replace: true })}
    />
  );
}
