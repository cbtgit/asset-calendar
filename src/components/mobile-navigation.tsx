import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { signOut } from "@/api/auth";
import type { ActiveModule } from "./app-shell";
import { MobileNavigationDrawer } from "./mobile-navigation-drawer";
import { renderMobileTrigger } from "./mobile-navigation-trigger";

type MobileNavigationProps = {
  activeModule: ActiveModule;
  isAdministrator: boolean;
  navigationKey: string;
};

function scheduleOpenerFocus() {
  window.setTimeout(
    () => document.querySelector<HTMLButtonElement>(".shell-mobile-trigger")?.focus(),
    0,
  );
}

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
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      if (wasOpenRef.current) openerRef.current?.focus();
      wasOpenRef.current = false;
      return;
    }

    wasOpenRef.current = true;
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
  const handlePopState = useCallback(() => setIsOpen(false), []);

  useDrawerLifecycle({ isOpen, drawerRef, openerRef, onPopState: handlePopState });

  function closeDrawer(traverseHistory = true) {
    setIsOpen(false);
    scheduleOpenerFocus();
    if (traverseHistory && window.history.state?.mobileNavigation) window.history.back();
  }

  function openDrawer() {
    window.history.pushState(
      { ...(window.history.state ?? {}), mobileNavigation: true },
      "",
      window.location.href,
    );
    setExpandedModule(activeModule);
    setIsOpen(true);
  }

  function handleLogOut() {
    signOut();
    closeDrawer(false);
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
          onSelectRoute={() => closeDrawer(false)}
          onLogOut={handleLogOut}
          onToggleModule={setExpandedModule}
          navigationKey={navigationKey}
        />
      ) : null}
    </>
  );
}
