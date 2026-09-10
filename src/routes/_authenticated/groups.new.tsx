import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { getAuthSnapshot, isAdministrator } from "@/api/auth";
import { GroupForm } from "@/components/group-form";

export const Route = createFileRoute("/_authenticated/groups/new")({
  beforeLoad: async () => {
    if (!isAdministrator(getAuthSnapshot().user)) {
      throw redirect({ to: "/calendar" });
    }
  },
  component: NewGroupPage,
});

function NewGroupPage() {
  const navigate = useNavigate();
  return (
    <GroupForm
      mode="create"
      onCancel={() => void navigate({ to: "/groups", replace: true })}
      onSuccess={() => void navigate({ to: "/groups", replace: true })}
    />
  );
}
