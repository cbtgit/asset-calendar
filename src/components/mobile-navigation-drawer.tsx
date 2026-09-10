import { forwardRef } from "react";
import type { ActiveModule } from "./app-shell";
import {
  renderDrawerFooter,
  renderDrawerHeader,
  renderDrawerLinks,
} from "./mobile-navigation-drawer-parts";

type MobileNavigationDrawerProps = {
  expandedModule: ActiveModule | null;
  isAdministrator: boolean;
  navigationKey: string;
  onClose: () => void;
  onLogOut: () => void;
  onToggleModule: (module: ActiveModule | null) => void;
};

export const MobileNavigationDrawer = forwardRef<HTMLElement, MobileNavigationDrawerProps>(
  function MobileNavigationDrawer(
    { expandedModule, isAdministrator, onClose, onLogOut, onToggleModule, navigationKey },
    ref,
  ) {
    return (
      <div className="shell-mobile-layer" key={navigationKey}>
        <button
          className="shell-mobile-backdrop"
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
        />
        <aside
          ref={ref}
          id="mobile-navigation-drawer"
          className="shell-mobile-drawer"
          aria-label="Mobile navigation"
          tabIndex={-1}
        >
          {renderDrawerHeader(onClose)}
          {renderDrawerLinks({
            expandedModule,
            isAdministrator,
            onClose,
            onToggleModule,
          })}
          {renderDrawerFooter(onLogOut)}
        </aside>
      </div>
    );
  },
);
