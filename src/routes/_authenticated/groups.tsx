import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuthSnapshot, isAdministrator } from "@/api/auth";

export const Route = createFileRoute("/_authenticated/groups")({
  beforeLoad: async () => {
    if (!isAdministrator(getAuthSnapshot().user)) {
      throw redirect({ to: "/calendar" });
    }
  },
  component: GroupsPage,
});

function GroupsPage() {
  return (
    <>
      <p className="eyebrow">Administration</p>
      <h1>Groups</h1>
      <p>Group administration will be available here.</p>
    </>
  );
}
