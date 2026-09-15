import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { GroupForm } from "@/components/administration/groups/group-form";

export const Route = createFileRoute("/_authenticated/groups/new")({
  component: NewGroupPage,
});

function NewGroupPage() {
  const navigate = useNavigate();
  return (
    <GroupForm
      mode="create"
      onCancel={() => void navigate({ to: "/administration/groups", replace: true })}
      onSuccess={() => void navigate({ to: "/administration/groups", replace: true })}
    />
  );
}
