import type { ActiveModule } from "./app-shell";
import { MobileNavigationDrawer } from "./mobile-navigation-drawer";
import { MobileNavigationTrigger } from "./mobile-navigation-trigger";
import { useMobileNavigation } from "./use-mobile-navigation";

type MobileNavigationProps = {
  activeModule: ActiveModule;
  isAdministrator: boolean;
  navigationKey: string;
};

export function MobileNavigation({
  activeModule,
  isAdministrator,
  navigationKey,
}: MobileNavigationProps) {
  const {
    drawerRef,
    expandedModule,
    isOpen,
    openerRef,
    closeDrawer,
    handleLogOut,
    openDrawer,
    setExpandedModule,
  } = useMobileNavigation(activeModule);

  return (
    <>
      <MobileNavigationTrigger
        isOpen={isOpen}
        openerRef={openerRef}
        onClick={isOpen ? closeDrawer : openDrawer}
      />
      {isOpen ? (
        <MobileNavigationDrawer
          ref={drawerRef}
          expandedModule={expandedModule}
          isAdministrator={isAdministrator}
          onClose={closeDrawer}
          onSelectRoute={() => closeDrawer(false)}
          onLogOut={handleLogOut}
          onToggleModule={setExpandedModule}
          navigationKey={navigationKey}
        />
      ) : null}
    </>
  );
}
