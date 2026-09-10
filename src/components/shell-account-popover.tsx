type ShellAccountPopoverProps = {
  onLogOut: () => void;
};

export function ShellAccountPopover({ onLogOut }: ShellAccountPopoverProps) {
  return (
    <div className="shell-account-popover" role="menu">
      <button className="shell-account-action" type="button" role="menuitem" onClick={onLogOut}>
        Log out
      </button>
    </div>
  );
}
