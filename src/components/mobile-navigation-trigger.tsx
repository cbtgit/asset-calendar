import type { RefObject } from "react";

export function renderMobileTrigger(
  isOpen: boolean,
  openerRef: RefObject<HTMLButtonElement | null>,
  onClick: () => void,
) {
  return (
    <button
      ref={openerRef}
      className="shell-mobile-trigger"
      type="button"
      aria-expanded={isOpen}
      aria-controls="mobile-navigation-drawer"
      onClick={onClick}
    >
      <span className="shell-mobile-trigger-icon" aria-hidden="true">
        {isOpen ? "×" : "☰"}
      </span>
      <span className="sr-only">{isOpen ? "Close navigation" : "Open navigation"}</span>
    </button>
  );
}
