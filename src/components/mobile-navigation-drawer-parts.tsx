import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { getAuthSnapshot } from "@/api/auth";
import type { ActiveModule } from "./app-shell";

export function getMobileUserName(): string {
  const { user } = getAuthSnapshot();
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
  return name || user?.email || "Current user";
}

export function renderMobileModuleSection({
  module,
  children,
  expandedModule,
  onToggleModule,
}: {
  module: ActiveModule;
  children: ReactNode;
  expandedModule: ActiveModule | null;
  onToggleModule: (module: ActiveModule | null) => void;
}) {
  const expanded = expandedModule === module;
  return (
    <div className="shell-mobile-section">
      <button
        className="shell-mobile-section-trigger"
        type="button"
        aria-expanded={expanded}
        onClick={() => onToggleModule(expanded ? null : module)}
      >
        {module === "calendar" ? "Calendar" : "Administration"}
      </button>
      {expanded ? children : null}
    </div>
  );
}

export function renderDrawerHeader(onClose: () => void) {
  return (
    <div className="shell-mobile-drawer-header">
      <span className="shell-mobile-drawer-title">Navigation</span>
      <button
        className="shell-mobile-close"
        type="button"
        aria-label="Close navigation"
        onClick={onClose}
      >
        ×
      </button>
    </div>
  );
}

export function renderDrawerLinks({
  expandedModule,
  isAdministrator,
  onClose,
  onToggleModule,
}: {
  expandedModule: ActiveModule | null;
  isAdministrator: boolean;
  onClose: () => void;
  onToggleModule: (module: ActiveModule | null) => void;
}) {
  return (
    <nav aria-label="Mobile primary navigation" className="shell-mobile-links">
      {renderMobileModuleSection({
        module: "calendar",
        expandedModule,
        onToggleModule,
        children: (
          <Link className="shell-mobile-child-link" to="/calendar" onClick={onClose}>
            Calendar
          </Link>
        ),
      })}
      {isAdministrator
        ? renderMobileModuleSection({
            module: "administration",
            expandedModule,
            onToggleModule,
            children: (
              <Link className="shell-mobile-child-link" to="/groups" onClick={onClose}>
                Groups
              </Link>
            ),
          })
        : null}
    </nav>
  );
}

export function renderDrawerFooter(onLogOut: () => void) {
  return (
    <div className="shell-mobile-footer">
      <span className="shell-mobile-user">{getMobileUserName()}</span>
      <button className="shell-mobile-logout" type="button" onClick={onLogOut}>
        Log out
      </button>
    </div>
  );
}
