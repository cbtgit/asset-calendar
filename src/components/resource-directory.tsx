import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { Resource } from "@/api/resources";
import { useArchiveResourceMutation, useResourcesQuery } from "@/hooks/use-resources";
import { useTenantSettingsQuery } from "@/hooks/use-tenant-settings";
import { formatMoney } from "@/lib/money";
import { useDialogLifecycle } from "./dialog-focus";
import "./resource-admin.css";

// oxlint-disable-next-line complexity, max-lines-per-function
export function ResourceDirectory() {
  const resources = useResourcesQuery();
  const settings = useTenantSettingsQuery();
  const archive = useArchiveResourceMutation();
  const [pending, setPending] = useState<Resource | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  useDialogLifecycle({
    dialogRef,
    cancelRef,
    confirmRef,
    onCancel: () => setPending(null),
    active: pending !== null,
  });
  useEffect(() => {
    if (archive.isPending) dialogRef.current?.focus();
  }, [archive.isPending]);

  if (resources.isPending || settings.isPending) return <p role="status">Loading resources…</p>;
  if (resources.isError || settings.isError) {
    return (
      <div className="resource-state" role="alert">
        <p>We could not load resources: {(resources.error ?? settings.error)?.message}</p>
        <button
          type="button"
          onClick={() => {
            void resources.refetch();
            void settings.refetch();
          }}
        >
          Retry
        </button>
      </div>
    );
  }
  const confirmArchive = () => {
    if (!pending) return;
    archive.mutate(pending.id, {
      onSuccess: () => {
        setPending(null);
        queueMicrotask(() => statusRef.current?.focus());
      },
      onSettled: () => setPending(null),
    });
  };

  return (
    <section className="resource-admin" aria-label="Resources administration">
      <div className="resource-admin-header">
        <p ref={statusRef} tabIndex={-1}>
          {resources.data.length} resource{resources.data.length === 1 ? "" : "s"}
        </p>
        <Link className="resource-primary-action" to="/resources/new">
          New resource
        </Link>
      </div>
      {archive.isError ? (
        <p className="resource-error" role="alert">
          We could not archive the resource: {archive.error.message}
        </p>
      ) : null}
      {resources.data.length === 0 ? (
        <p className="resource-empty">No resources have been created yet.</p>
      ) : (
        <ul className="resource-list">
          {resources.data.map((resource) => (
            <li className="resource-row" key={resource.id}>
              <div>
                <strong>{resource.name}</strong>
                {resource.archived ? <span className="resource-badge">Archived</span> : null}
              </div>
              <span>
                {formatMoney(
                  resource.base_rate_minor_units,
                  settings.data.locale,
                  settings.data.currency,
                )}
              </span>
              <div className="resource-actions">
                {!resource.archived ? (
                  <>
                    <Link
                      className="resource-action"
                      to="/resources/$resourceId/edit"
                      params={{ resourceId: resource.id }}
                    >
                      Edit
                    </Link>
                    <button
                      className="resource-action resource-danger"
                      type="button"
                      onClick={() => setPending(resource)}
                    >
                      Archive
                    </button>
                  </>
                ) : (
                  <span className="resource-muted">Unavailable for new bookings</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {pending ? (
        <div className="resource-dialog-backdrop">
          <section
            ref={dialogRef}
            className="resource-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="archive-resource-title"
            tabIndex={-1}
          >
            <h2 id="archive-resource-title">Archive {pending.name}?</h2>
            <p>
              This action is permanent. The resource will remain visible for history but cannot
              receive new bookings.
            </p>
            <div className="resource-dialog-actions">
              <button
                ref={cancelRef}
                type="button"
                onClick={() => setPending(null)}
                disabled={archive.isPending}
              >
                Cancel
              </button>
              <button
                ref={confirmRef}
                className="resource-danger"
                type="button"
                onClick={confirmArchive}
                disabled={archive.isPending}
              >
                {archive.isPending ? "Archiving…" : "Archive resource"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
