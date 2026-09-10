import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { GroupForm } from "@/components/group-form";

export const Route = createFileRoute("/_authenticated/groups/new")({
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
