import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { groupsQueryOptions } from "@/api/groups";
import { GroupsDirectory } from "@/components/administration/groups/groups-directory";
import { queryClient } from "@/lib/query-client";

export const Route = createFileRoute("/_authenticated/administration/groups/")({
  loader: () => {
    void queryClient.prefetchQuery(groupsQueryOptions()).catch(() => undefined);
  },
  component: GroupsIndexPage,
});

function GroupsIndexPage() {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <>
      <p className="eyebrow">Administration</p>
      <GroupsDirectory headingRef={headingRef} />
    </>
  );
}
