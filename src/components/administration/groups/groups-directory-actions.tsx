import { Link } from "@tanstack/react-router";
import type { Group } from "@/api/groups";
import { Button } from "../../base/Button";

function memberLabel(count: number) {
  return `${count} ${count === 1 ? "member" : "members"}`;
}

export function GroupsDirectoryActions({
  group,
  deleting,
  onDelete,
}: {
  group: Group;
  deleting: boolean;
  onDelete: (group: Group) => void;
}) {
  const blocked = group.member_count > 0;
  const blockedMessage = `Delete unavailable: ${memberLabel(group.member_count)} assigned`;

  return (
    <div className="groups-directory-actions">
      <Link
        className="groups-directory-action"
        to="/administration/groups/$groupId/edit"
        params={{ groupId: group.id }}
        aria-label={`Rename ${group.name}`}
      >
        Rename
      </Link>
      <Button
        className="groups-directory-action groups-directory-delete"
        size="compact"
        variant="danger"
        disabled={blocked || deleting}
        title={blocked ? blockedMessage : undefined}
        onClick={() => onDelete(group)}
      >
        {deleting ? "Deleting…" : "Delete"}
      </Button>
      {blocked ? <span className="groups-directory-hint">{blockedMessage}</span> : null}
    </div>
  );
}
