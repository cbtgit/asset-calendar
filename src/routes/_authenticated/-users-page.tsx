import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Button } from "@/components/base/Button";
import { UsersDirectory } from "@/components/administration/users/users-directory";

export function UsersPage() {
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <>
      <p className="eyebrow">Administration</p>
      <div className="booking-types-header">
        <div>
          <h1 ref={headingRef} tabIndex={-1}>
            Users
          </h1>
          <p>Manage tenant access and invitations.</p>
        </div>
        <Button
          variant="primary"
          onClick={() => void navigate({ to: "/administration/users/new" })}
        >
          New User
        </Button>
      </div>
      <UsersDirectory />
    </>
  );
}
