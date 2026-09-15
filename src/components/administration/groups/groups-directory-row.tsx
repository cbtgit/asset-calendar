import type { Group } from "@/api/groups";
import { GroupsDirectoryActions } from "./groups-directory-actions";

function memberLabel(count: number) {
  return `${count} ${count === 1 ? "member" : "members"}`;
}

export function GroupRow({
  group,
  deleting,
  onDelete,
}: {
  group: Group;
  deleting: boolean;
  onDelete: (group: Group) => void;
}) {
  return (
    <li className="groups-directory-row">
      <div className="groups-directory-name">
        <span className="groups-directory-label">Group</span>
        <strong>{group.name}</strong>
      </div>
      <div className="groups-directory-members">
        <span className="groups-directory-label">Assigned members</span>
        <span>{memberLabel(group.member_count)}</span>
      </div>
      <GroupsDirectoryActions group={group} deleting={deleting} onDelete={onDelete} />
    </li>
  );
}
