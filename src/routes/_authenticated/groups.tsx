import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
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
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <>
      <p className="eyebrow">Administration</p>
      <h1 ref={headingRef} tabIndex={-1}>
        Groups
      </h1>
      <p>Group administration will be available here.</p>
      <Outlet />
    </>
  );
}
