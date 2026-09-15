import type { Group } from "@/api/groups";
import { GroupRow } from "./groups-directory-row";

export function GroupsDirectoryList({
  groups,
  deletingId,
  onDelete,
}: {
  groups: Group[];
  deletingId: string | undefined;
  onDelete: (group: Group) => void;
}) {
  if (groups.length === 0) {
    return <p className="groups-directory-empty">No groups have been created yet.</p>;
  }

  return (
    <ul className="groups-directory-list">
      <li className="groups-directory-table-heading" aria-hidden="true">
        <span>Group</span>
        <span>Assigned members</span>
        <span>Actions</span>
      </li>
      {groups.map((group) => (
        <GroupRow
          key={group.id}
          group={group}
          deleting={deletingId === group.id}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}
