import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getGroup } from "@/api/groups";
import { GroupForm } from "@/components/group-form";
import { GroupEditError } from "@/components/group-edit-error";

export const Route = createFileRoute("/_authenticated/groups/$groupId/edit")({
  loader: ({ params }) => getGroup(params.groupId),
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
      onCancel={() => void navigate({ to: "/groups", replace: true })}
      onSuccess={() => void navigate({ to: "/groups", replace: true })}
    />
  );
}
