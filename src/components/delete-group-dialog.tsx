import type { Group } from "@/api/groups";

export function DeleteGroupDialog({
  group,
  pending,
  onCancel,
  onConfirm,
}: {
  group: Group;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="groups-directory-dialog-backdrop">
      <section
        className="groups-directory-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-group-title"
      >
        <h2 id="delete-group-title">Delete {group.name}?</h2>
        <p>This action cannot be undone.</p>
        <div className="groups-directory-dialog-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="groups-directory-delete"
            type="button"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? "Deleting…" : "Delete group"}
          </button>
        </div>
      </section>
    </div>
  );
}
