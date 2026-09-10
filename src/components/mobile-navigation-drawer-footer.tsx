import { getShellUserName } from "./shell-account-user";

type MobileNavigationDrawerFooterProps = {
  onLogOut: () => void;
};

export function MobileNavigationDrawerFooter({ onLogOut }: MobileNavigationDrawerFooterProps) {
  return (
    <div className="shell-mobile-footer">
      <span className="shell-mobile-user">{getShellUserName()}</span>
      <button className="shell-mobile-logout" type="button" onClick={onLogOut}>
        Log out
      </button>
    </div>
  );
}
