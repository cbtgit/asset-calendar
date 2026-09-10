import { signOut } from "@/api/auth";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { ShellAccountPopover } from "./shell-account-popover";
import { getShellUserName } from "./shell-account-user";
import { ShellAccountTrigger } from "./shell-account-trigger";
import { ShellMobileAccountAvatar } from "./shell-mobile-account-avatar";
import { useOutsidePointerDown } from "./use-outside-pointer-down";

export function ShellAccountMenu() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const userName = getShellUserName();
  const closeMenu = useCallback(() => setIsOpen(false), []);

  useOutsidePointerDown(menuRef, isOpen, closeMenu);

  return (
    <>
      <div className="shell-account" ref={menuRef}>
        <ShellAccountTrigger
          isOpen={isOpen}
          userName={userName}
          onToggle={() => setIsOpen((open) => !open)}
        />
        {isOpen ? (
          <ShellAccountPopover
            onLogOut={() => {
              signOut();
              void navigate({ to: "/sign-in", replace: true });
            }}
          />
        ) : null}
      </div>
      <ShellMobileAccountAvatar />
    </>
  );
}
