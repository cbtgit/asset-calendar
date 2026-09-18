import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { resourceQueryOptions } from "@/api/resources";
import { Loading } from "@/components/base/Loading";
import { ResourceForm } from "@/components/administration/resources/resource-form";
import { queryClient } from "@/lib/query-client";

export const Route = createFileRoute("/_authenticated/administration/resources/$resourceId/edit")({
  loader: ({ params }) => queryClient.ensureQueryData(resourceQueryOptions(params.resourceId)),
  pendingComponent: () => <Loading className="loading-page" />,
  component: ResourceEditPage,
  shouldReload: true,
  gcTime: 0,
});

function ResourceEditPage() {
  const resource = Route.useLoaderData();
  const navigate = useNavigate();

  return (
    <ResourceForm
      mode="edit"
      initialResource={resource}
      onCancel={() => void navigate({ to: "/administration/resources", replace: true })}
      onSuccess={() => void navigate({ to: "/administration/resources", replace: true })}
    />
  );
}
