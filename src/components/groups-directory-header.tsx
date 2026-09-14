import { Link } from "@tanstack/react-router";

export function GroupsDirectoryHeader({ count }: { count: number }) {
  return (
    <div className="groups-directory-header">
      <div>
        <p className="groups-directory-count">
          {count} {count === 1 ? "group" : "groups"}
        </p>
        <p>Manage the groups available to your organization.</p>
      </div>
      <Link className="groups-directory-add" to="/groups/new">
        Add Group
      </Link>
    </div>
  );
}
