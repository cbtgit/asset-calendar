import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getUser, type User } from "@/api/users";
import { usersKeys } from "@/api/query-keys";
import { Loading } from "@/components/base/Loading";
import { UserForm } from "@/components/administration/users/user-form";
import { queryClient } from "@/lib/query-client";

export const Route = createFileRoute("/_authenticated/administration/users/$userId/edit")({
  loader: ({ params }) =>
    queryClient.getQueryData<User[]>(usersKeys.list())?.find((user) => user.id === params.userId) ??
    getUser(params.userId),
  pendingComponent: () => <Loading className="loading-page" />,
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
