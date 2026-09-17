import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getResource } from "@/api/resources";
import { Loading } from "@/components/base/Loading";
import { ResourceForm } from "@/components/administration/resources/resource-form";
import { useTenantDisplaySettings } from "@/hooks/use-tenant-display-settings";

export const Route = createFileRoute("/_authenticated/administration/resources/$resourceId/edit")({
  loader: ({ params }) => getResource(params.resourceId),
  pendingComponent: () => <Loading className="loading-page" />,
  component: ResourceEditPage,
  shouldReload: true,
  gcTime: 0,
});

function ResourceEditPage() {
  const resource = Route.useLoaderData();
  const navigate = useNavigate();
  const settings = useTenantDisplaySettings();

  return (
    <ResourceForm
      mode="edit"
      initialResource={resource}
      locale={settings.locale}
      onCancel={() => void navigate({ to: "/administration/resources", replace: true })}
      onSuccess={() => void navigate({ to: "/administration/resources", replace: true })}
    />
  );
}
