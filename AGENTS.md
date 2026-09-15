# Agent Instructions

## GitHub issue scope

When implementing a GitHub issue, read its parent feature for context and
dependencies, but implement only the work explicitly included in the issue.
Do not expand the change to cover adjacent parent-feature work unless the issue
is updated first.

## Optimistic mutations

For create, update, and delete operations in the calendar and administration
interfaces, use optimistic updates with TanStack Query.

Mutation implementations must:

- Cancel affected in-flight queries before applying the optimistic change.
- Snapshot the affected cached data so a failed mutation can roll back cleanly.
- Update the cache immediately so the interface responds without waiting for the
  server response.
- Restore the snapshot when the mutation fails and surface the error to the
  user.
- Invalidate or otherwise reconcile affected queries after settlement so the
  cache reflects the server-authoritative result.

Keep PocketBase as the source of truth. Optimistic updates improve interaction
latency but must not weaken backend validation or authorization. Leave business logic checks to the backend.
