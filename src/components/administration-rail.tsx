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
      <Link
        className="shell-rail-link"
        data-active={activeDestination === "resources" ? "true" : undefined}
        to="/resources"
      >
        Resources
      </Link>
      <Link
        className="shell-rail-link"
        data-active={activeDestination === "settings" ? "true" : undefined}
        to="/settings"
      >
        Settings
      </Link>
      <Link
        className="shell-rail-link"
        data-active={activeDestination === "booking-types" ? "true" : undefined}
        to="/booking-types"
      >
        Booking types
      </Link>
    </nav>
  );
}
