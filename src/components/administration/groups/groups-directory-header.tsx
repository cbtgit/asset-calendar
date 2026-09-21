import { Link } from "@tanstack/react-router";
import type { RefObject } from "react";

export function GroupsDirectoryHeader({
  headingRef,
}: {
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <div className="groups-directory-header">
      <div>
        <h1 ref={headingRef} tabIndex={-1}>
          Groups
        </h1>
        <p>Manage the groups available to your organization.</p>
      </div>
      <Link className="groups-directory-add" to="/administration/groups/new">
        Add Group
      </Link>
    </div>
  );
}
