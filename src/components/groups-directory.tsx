import { useState } from "react";
import type { Group } from "@/api/groups";
import { useDeleteGroupMutation, useGroupsQuery } from "@/hooks/use-groups";
import { DeleteGroupDialog } from "./delete-group-dialog";
import { GroupsDirectoryHeader } from "./groups-directory-header";
import { GroupsDirectoryList } from "./groups-directory-list";
import { GroupsDirectoryLoadError } from "./groups-directory-load-error";
import { GroupsDirectoryMutationError } from "./groups-directory-mutation-error";
import "./groups-directory.css";

export function GroupsDirectory() {
  const groups = useGroupsQuery();
  const deleteMutation = useDeleteGroupMutation();
  const [pendingDelete, setPendingDelete] = useState<Group | null>(null);

  if (groups.isPending) {
    return <p role="status">Loading groups…</p>;
  }

  if (groups.isError) {
    return <GroupsDirectoryLoadError message={groups.error.message} onRetry={groups.refetch} />;
  }

  const deletingId = deleteMutation.isPending ? deleteMutation.variables : undefined;
  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteMutation.mutate(pendingDelete.id, {
      onSuccess: () => setPendingDelete(null),
      onError: () => setPendingDelete(null),
    });
  };

  return (
    <section className="groups-directory" aria-label="Groups directory">
      <GroupsDirectoryHeader count={groups.data.length} />
      {deleteMutation.isError ? (
        <GroupsDirectoryMutationError message={deleteMutation.error.message} />
      ) : null}
      <GroupsDirectoryList
        groups={groups.data}
        deletingId={deletingId}
        onDelete={setPendingDelete}
      />
      {pendingDelete ? (
        <DeleteGroupDialog
          group={pendingDelete}
          pending={deleteMutation.isPending}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </section>
  );
}
