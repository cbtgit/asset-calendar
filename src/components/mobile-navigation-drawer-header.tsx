import { CloseButton } from "@/components/base/CloseButton";

type MobileNavigationDrawerHeaderProps = {
  onClose: () => void;
};

export function MobileNavigationDrawerHeader({ onClose }: MobileNavigationDrawerHeaderProps) {
  return (
    <div className="shell-mobile-drawer-header">
      <span className="shell-mobile-drawer-title">Navigation</span>
      <CloseButton className="shell-mobile-close" label="Close navigation" onClick={onClose} />
    </div>
  );
}
