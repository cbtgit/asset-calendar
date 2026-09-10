type MobileNavigationDrawerHeaderProps = {
  onClose: () => void;
};

export function MobileNavigationDrawerHeader({ onClose }: MobileNavigationDrawerHeaderProps) {
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
