import { Link } from "@tanstack/react-router";
import { useUsersQuery } from "@/hooks/use-users";
import type { User } from "@/api/users";
import "./users-directory.css";

function UserRow({ user }: { user: User }) {
  return (
    <li className="users-directory-row">
      <div>
        <span className="users-directory-label">User</span>
        <strong>{user.display_name || user.email}</strong>
        <p>{user.email}</p>
      </div>
      <div className="users-directory-details">
        <div>
          <span className="users-directory-label">Group</span>
          <span>{user.group}</span>
        </div>
        <div>
          <span className="users-directory-label">Role</span>
          <span>{user.role === "administrator" ? "Administrator" : "Regular user"}</span>
        </div>
      </div>
      <div className="users-directory-status-actions">
        <div className="users-directory-status">
          <span className="users-directory-label">Status</span>
          <span
            className={`users-directory-status-value ${
              user.active
                ? "users-directory-status-value-active"
                : "users-directory-status-value-inactive"
            }`}
          >
            {user.active ? "Active" : "Inactive"}
          </span>
          {user.password_setup_pending ? <small>Invitation pending</small> : null}
        </div>
        <Link
          className="users-directory-edit"
          to="/administration/users/$userId/edit"
          params={{ userId: user.id }}
          aria-label={`Edit ${user.display_name || user.email}`}
        >
          Edit
        </Link>
      </div>
    </li>
  );
}

export function UsersDirectory() {
  const users = useUsersQuery();

  if (users.isPending) return <p role="status">Loading users…</p>;
  if (users.isError) {
    return (
      <div className="users-directory-state">
        <p role="alert">Unable to load users: {users.error.message}</p>
        <button type="button" onClick={() => void users.refetch()}>
          Retry
        </button>
      </div>
    );
  }
  if (users.data.length === 0)
    return <p className="users-directory-empty">No users have been created yet.</p>;

  return (
    <section className="users-directory" aria-label="Users directory">
      <ul className="users-directory-list">
        {users.data.map((user) => (
          <UserRow key={user.id} user={user} />
        ))}
      </ul>
    </section>
  );
}
