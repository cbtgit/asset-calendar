import { getShellUserInitials, getShellUserName } from "./shell-account-user";

export function ShellMobileAccountAvatar() {
  const userName = getShellUserName();

  return (
    <span
      className="shell-mobile-account-avatar"
      role="img"
      aria-label={`Signed in as ${userName}`}
    >
      {getShellUserInitials(userName)}
    </span>
  );
}
