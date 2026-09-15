import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getUser } from "@/api/users";
import { UserForm } from "@/components/administration/users/user-form";

export const Route = createFileRoute("/_authenticated/administration/users/$userId/edit")({
  loader: ({ params }) => getUser(params.userId),
  shouldReload: true,
  gcTime: 0,
  component: EditUserPage,
});

function EditUserPage() {
  const user = Route.useLoaderData();
  const navigate = useNavigate();
  return (
    <UserForm
      mode="edit"
      user={user}
      onCancel={() => void navigate({ to: "/administration/users", replace: true })}
      onSuccess={() => void navigate({ to: "/administration/users", replace: true })}
    />
  );
}
