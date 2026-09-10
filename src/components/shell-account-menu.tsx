import { getAuthSnapshot, signOut } from "@/api/auth";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

function getUserName(): string {
  const { user } = getAuthSnapshot();
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
  return name || user?.email || "Current user";
}

function getInitials(name: string): string {
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return initials || "?";
}

function renderShellAccountPopover(onLogOut: () => void) {
  return (
    <div className="shell-account-popover" role="menu">
      <button className="shell-account-action" type="button" role="menuitem" onClick={onLogOut}>
        Log out
      </button>
    </div>
  );
}

export function ShellAccountMenu() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const userName = getUserName();

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", handleOutsidePointerDown);
  }, [isOpen]);

  return (
    <div className="shell-account" ref={menuRef}>
      <button
        className="shell-account-trigger"
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="shell-account-avatar" aria-hidden="true">
          {getInitials(userName)}
        </span>
        <span>{userName}</span>
      </button>
      {isOpen
        ? renderShellAccountPopover(() => {
            signOut();
            void navigate({ to: "/sign-in", replace: true });
          })
        : null}
    </div>
  );
}
