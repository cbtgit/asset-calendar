import { Link } from "@tanstack/react-router";
import { BookOpen, Boxes, ReceiptText, Settings, UserRound, Users } from "lucide-react";

export function AdministrationRail() {
  return (
    <aside aria-label="Administration rail" className="shell-rail">
      <p className="shell-rail-label">Administration</p>
      <Link
        className="shell-rail-link"
        to="/administration/users"
        activeOptions={{ exact: false }}
        activeProps={{ "data-active": "true" }}
      >
        <UserRound aria-hidden="true" className="shell-rail-icon" />
        Users
      </Link>
      <Link
        className="shell-rail-link"
        to="/administration/groups"
        activeOptions={{ exact: false }}
        activeProps={{ "data-active": "true" }}
      >
        <Users aria-hidden="true" className="shell-rail-icon" />
        Groups
      </Link>

      <Link
        className="shell-rail-link"
        to="/administration/booking-types"
        activeOptions={{ exact: false }}
        activeProps={{ "data-active": "true" }}
      >
        <BookOpen aria-hidden="true" className="shell-rail-icon" />
        Booking Types
      </Link>
      <Link
        className="shell-rail-link"
        to="/administration/resources"
        activeOptions={{ exact: false }}
        activeProps={{ "data-active": "true" }}
      >
        <Boxes aria-hidden="true" className="shell-rail-icon" />
        Resources
      </Link>
      <Link
        className="shell-rail-link"
        to="/administration/billing"
        activeOptions={{ exact: false }}
        activeProps={{ "data-active": "true" }}
      >
        <ReceiptText aria-hidden="true" className="shell-rail-icon" />
        Billing
      </Link>
      <Link
        className="shell-rail-link"
        to="/administration/settings"
        activeOptions={{ exact: false }}
        activeProps={{ "data-active": "true" }}
      >
        <Settings aria-hidden="true" className="shell-rail-icon" />
        Settings
      </Link>
    </aside>
  );
}
