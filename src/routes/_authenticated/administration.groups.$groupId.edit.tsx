import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { groupQueryOptions } from "@/api/groups";
import { Loading } from "@/components/base/Loading";
import { GroupForm } from "@/components/administration/groups/group-form";
import { GroupEditError } from "@/components/administration/groups/group-edit-error";
import { queryClient } from "@/lib/query-client";

export const Route = createFileRoute("/_authenticated/administration/groups/$groupId/edit")({
  loader: ({ params }) => queryClient.ensureQueryData(groupQueryOptions(params.groupId)),
  pendingComponent: () => <Loading className="loading-page" />,
  errorComponent: GroupEditError,
  component: GroupEditPage,
  shouldReload: true,
  gcTime: 0,
});

function GroupEditPage() {
  const group = Route.useLoaderData();
  const navigate = useNavigate();
  return (
    <GroupForm
      mode="edit"
      groupId={group.id}
      initialName={group.name}
      onCancel={() => void navigate({ to: "/administration/groups", replace: true })}
      onSuccess={() => void navigate({ to: "/administration/groups", replace: true })}
    />
  );
}
