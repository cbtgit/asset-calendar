import { Link } from "@tanstack/react-router";

export function AdministrationRail() {
  return (
    <nav aria-label="Administration navigation" className="shell-rail">
      <p className="shell-rail-label">Administration</p>
      <Link
        className="shell-rail-link"
        to="/administration/groups"
        activeOptions={{ exact: false }}
        activeProps={{ "data-active": "true" }}
      >
        Groups
      </Link>

      <Link
        className="shell-rail-link"
        to="/administration/booking-types"
        activeOptions={{ exact: false }}
        activeProps={{ "data-active": "true" }}
      >
        Booking Types
      </Link>
      <Link
        className="shell-rail-link"
        to="/administration/resources"
        activeOptions={{ exact: false }}
        activeProps={{ "data-active": "true" }}
      >
        Resources
      </Link>
    </nav>
  );
}
