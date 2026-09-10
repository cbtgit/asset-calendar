import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { getAuthSnapshot, isAdministrator } from "@/api/auth";
import { getGroup } from "@/api/groups";
import { GroupForm } from "@/components/group-form";
import { GroupEditError } from "@/components/group-edit-error";

export const Route = createFileRoute("/_authenticated/groups/$groupId/edit")({
  beforeLoad: async () => {
    if (!isAdministrator(getAuthSnapshot().user)) {
      throw redirect({ to: "/calendar" });
    }
  },
  loader: ({ params }) => getGroup(params.groupId),
  errorComponent: GroupEditError,
  component: GroupEditPage,
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
