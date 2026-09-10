import { Link } from "@tanstack/react-router";
import type { ActiveDestination } from "./app-shell";

type AdministrationRailProps = {
  activeDestination: ActiveDestination;
};

export function AdministrationRail({ activeDestination }: AdministrationRailProps) {
  return (
    <nav aria-label="Administration navigation" className="shell-rail">
      <p className="shell-rail-label">Administration</p>
      <Link
        className="shell-rail-link"
        data-active={activeDestination === "groups" ? "true" : undefined}
        to="/groups"
      >
        Groups
      </Link>
    </nav>
  );
}
