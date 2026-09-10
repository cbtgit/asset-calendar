import { Link } from "@tanstack/react-router";
import type { ActiveModule } from "./app-shell";
import { ShellSignOut } from "./shell-sign-out";

type ShellHeaderProps = {
  activeModule: ActiveModule;
  isAdministrator: boolean;
};

export function ShellHeader({ activeModule, isAdministrator }: ShellHeaderProps) {
  return (
    <header className="shell-header">
      <Link className="shell-brand" to="/calendar" aria-label="Asset Calendar home">
        <span className="shell-brand-mark" aria-hidden="true">
          AC
        </span>
        <span>Asset Calendar</span>
      </Link>
      <nav aria-label="Primary navigation" className="shell-modules">
        <Link
          className="shell-module-link"
          data-active={activeModule === "calendar" ? "true" : undefined}
          to="/calendar"
        >
          Calendar
        </Link>
        {isAdministrator ? (
          <Link
            className="shell-module-link"
            data-active={activeModule === "administration" ? "true" : undefined}
            to="/groups"
          >
            Administration
          </Link>
        ) : null}
      </nav>
      <ShellSignOut />
    </header>
  );
}
