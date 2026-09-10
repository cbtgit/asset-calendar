import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/_authenticated/groups/")({
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
      <p>Group administration will be available here.</p>
    </>
  );
}
