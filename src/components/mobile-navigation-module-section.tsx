import type { ReactNode } from "react";
import type { ActiveModule } from "./app-shell";

type MobileNavigationModuleSectionProps = {
  module: ActiveModule;
  children: ReactNode;
  expandedModule: ActiveModule | null;
  onToggleModule: (module: ActiveModule | null) => void;
};

export function MobileNavigationModuleSection({
  module,
  children,
  expandedModule,
  onToggleModule,
}: MobileNavigationModuleSectionProps) {
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
