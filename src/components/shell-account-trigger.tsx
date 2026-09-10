import { getShellUserInitials } from "./shell-account-user";

type ShellAccountTriggerProps = {
  isOpen: boolean;
  userName: string;
  onToggle: () => void;
};

export function ShellAccountTrigger({ isOpen, userName, onToggle }: ShellAccountTriggerProps) {
  return (
    <button
      className="shell-account-trigger"
      type="button"
      aria-expanded={isOpen}
      aria-haspopup="menu"
      onClick={onToggle}
    >
      <span className="shell-account-avatar" aria-hidden="true">
        {getShellUserInitials(userName)}
      </span>
      <span>{userName}</span>
    </button>
  );
}
