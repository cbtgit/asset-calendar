import { createFileRoute } from "@tanstack/react-router";
import { ResourceForm } from "@/components/resource-form";
import { useResourceQuery } from "@/hooks/use-resources";
import { useTenantSettingsQuery } from "@/hooks/use-tenant-settings";

export const Route = createFileRoute("/_authenticated/resources/$resourceId/edit")({
  component: EditResourcePage,
});

function EditResourcePage() {
  const { resourceId } = Route.useParams();
  const resource = useResourceQuery(resourceId);
  const settings = useTenantSettingsQuery();
  if (resource.isPending || settings.isPending) return <p role="status">Loading resource…</p>;
  if (resource.isError || settings.isError)
    return <p role="alert">We could not load this resource.</p>;
  return (
    <ResourceForm
      resource={resource.data}
      locale={settings.data.locale}
      currency={settings.data.currency}
    />
  );
}
