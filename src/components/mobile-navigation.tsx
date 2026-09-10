import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type RefObject } from "react";
import { signOut } from "@/api/auth";
import type { ActiveModule } from "./app-shell";
import { MobileNavigationDrawer } from "./mobile-navigation-drawer";
import { renderMobileTrigger } from "./mobile-navigation-trigger";

type MobileNavigationProps = {
  activeModule: ActiveModule;
  isAdministrator: boolean;
  navigationKey: string;
};

function useDrawerLifecycle({
  isOpen,
  drawerRef,
  openerRef,
  onPopState,
}: {
  isOpen: boolean;
  drawerRef: RefObject<HTMLElement | null>;
  openerRef: RefObject<HTMLButtonElement | null>;
  onPopState: () => void;
}) {
  useEffect(() => {
    if (!isOpen) {
      openerRef.current?.focus();
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.focus();
    window.addEventListener("popstate", onPopState);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("popstate", onPopState);
    };
  }, [drawerRef, isOpen, onPopState, openerRef]);
}

function useMobileNavigation(activeModule: ActiveModule) {
  const navigate = useNavigate();
  const openerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [expandedModule, setExpandedModule] = useState<ActiveModule | null>(activeModule);

  useDrawerLifecycle({ isOpen, drawerRef, openerRef, onPopState: () => setIsOpen(false) });

  function closeDrawer() {
    setIsOpen(false);
    if (window.history.state?.mobileNavigation) window.history.back();
  }

  function openDrawer() {
    window.history.pushState(
      { ...window.history.state, mobileNavigation: true },
      "",
      window.location.href,
    );
    setExpandedModule(activeModule);
    setIsOpen(true);
  }

  function handleLogOut() {
    signOut();
    closeDrawer();
    void navigate({ to: "/sign-in", replace: true });
  }

  return {
    drawerRef,
    expandedModule,
    isOpen,
    openerRef,
    closeDrawer,
    handleLogOut,
    openDrawer,
    setExpandedModule,
  };
}

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
      {renderMobileTrigger(isOpen, openerRef, isOpen ? closeDrawer : openDrawer)}
      {isOpen ? (
        <MobileNavigationDrawer
          ref={drawerRef}
          expandedModule={expandedModule}
          isAdministrator={isAdministrator}
          onClose={closeDrawer}
          onLogOut={handleLogOut}
          onToggleModule={setExpandedModule}
          navigationKey={navigationKey}
        />
      ) : null}
    </>
  );
}
