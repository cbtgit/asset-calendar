import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";

export function GroupEditError({ error }: ErrorComponentProps) {
  return (
    <section aria-labelledby="group-edit-error-title">
      <p className="eyebrow">Administration</p>
      <h1 id="group-edit-error-title">Group unavailable</h1>
      <p>That group could not be found or you do not have access to it.</p>
      <Link className="auth-link" to="/groups">
        Return to groups
      </Link>
      <span hidden>{error instanceof Error ? error.message : "Unknown group error"}</span>
    </section>
  );
}
