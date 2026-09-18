import { Link } from "@tanstack/react-router";
import { useTenantSettingsQuery } from "@/hooks/use-tenant-settings";
import type { ActiveModule } from "./app-shell";
import { MobileNavigation } from "./mobile-navigation";
import { ShellAccountMenu } from "./shell-account-menu";

type ShellHeaderProps = {
  activeModule: ActiveModule;
  isAdministrator: boolean;
  navigationKey: string;
};

export function ShellHeader({ activeModule, isAdministrator, navigationKey }: ShellHeaderProps) {
  const tenantSettings = useTenantSettingsQuery();
  const siteTitle = tenantSettings.isPending
    ? ""
    : tenantSettings.data?.site_title || "Asset Calendar";

  return (
    <header className="shell-header">
      <Link
        className="shell-brand"
        to="/calendar"
        search={{ date: "", view: "week", resource: "" }}
        aria-label={siteTitle ? `${siteTitle} home` : "Home"}
      >
        <span>{siteTitle}</span>
      </Link>
      <nav aria-label="Primary navigation" className="shell-modules">
        <Link
          className="shell-module-link"
          data-active={activeModule === "calendar" ? "true" : undefined}
          to="/calendar"
          search={{ date: "", view: "week", resource: "" }}
        >
          Calendar
        </Link>
        {isAdministrator ? (
          <Link
            className="shell-module-link"
            data-active={activeModule === "administration" ? "true" : undefined}
            to="/administration/users"
          >
            Administration
          </Link>
        ) : null}
      </nav>
      <ShellAccountMenu key={navigationKey} />
      <MobileNavigation
        key={`mobile-${navigationKey}`}
        activeModule={activeModule}
        isAdministrator={isAdministrator}
        navigationKey={navigationKey}
      />
    </header>
  );
}
