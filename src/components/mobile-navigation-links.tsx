import { Link } from "@tanstack/react-router";
import type { ActiveModule } from "./app-shell";
import { MobileNavigationModuleSection } from "./mobile-navigation-module-section";

type MobileNavigationLinksProps = {
  expandedModule: ActiveModule | null;
  isAdministrator: boolean;
  onSelectRoute: () => void;
  onToggleModule: (module: ActiveModule | null) => void;
};

export function MobileNavigationLinks({
  expandedModule,
  isAdministrator,
  onSelectRoute,
  onToggleModule,
}: MobileNavigationLinksProps) {
  return (
    <nav aria-label="Mobile primary navigation" className="shell-mobile-links">
      <MobileNavigationModuleSection
        module="calendar"
        expandedModule={expandedModule}
        onToggleModule={onToggleModule}
      >
        <Link className="shell-mobile-child-link" to="/calendar" onClick={onSelectRoute}>
          Calendar
        </Link>
      </MobileNavigationModuleSection>
      {isAdministrator ? (
        <MobileNavigationModuleSection
          module="administration"
          expandedModule={expandedModule}
          onToggleModule={onToggleModule}
        >
          <Link className="shell-mobile-child-link" to="/groups" onClick={onSelectRoute}>
            Groups
          </Link>
        </MobileNavigationModuleSection>
      ) : null}
    </nav>
  );
}
