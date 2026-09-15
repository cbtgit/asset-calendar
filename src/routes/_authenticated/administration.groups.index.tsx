import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { GroupsDirectory } from "@/components/administration/groups/groups-directory";

export const Route = createFileRoute("/_authenticated/administration/groups/")({
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
      <h1 ref={headingRef} tabIndex={-1}>
        Groups
      </h1>
      <GroupsDirectory />
    </>
  );
}
