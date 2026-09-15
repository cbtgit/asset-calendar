import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { UserForm } from "@/components/administration/users/user-form";

export const Route = createFileRoute("/_authenticated/administration/users/new")({
  component: NewUserPage,
});

function NewUserPage() {
  const navigate = useNavigate();
  return (
    <UserForm
      mode="create"
      onCancel={() => void navigate({ to: "/administration/users", replace: true })}
      onSuccess={() => void navigate({ to: "/administration/users", replace: true })}
    />
  );
}
