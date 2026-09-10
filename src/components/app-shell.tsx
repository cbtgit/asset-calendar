import "../App.css";
import { getAuthSnapshot, isAdministrator } from "@/api/auth";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { AdministrationRail } from "./administration-rail";
import { ShellHeader } from "./shell-header";

export type ActiveDestination = "calendar" | "groups";
export type ActiveModule = "calendar" | "administration";

// oxlint-disable-next-line eslint(react/only-export-components)
export function getActiveDestination(pathname: string): ActiveDestination {
  return pathname.startsWith("/groups") ? "groups" : "calendar";
}

// oxlint-disable-next-line eslint(react/only-export-components)
export function getActiveModule(pathname: string): ActiveModule {
  return pathname.startsWith("/groups") ? "administration" : "calendar";
}

export function AppShell() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const activeDestination = getActiveDestination(pathname);
  const activeModule = getActiveModule(pathname);
  const administrator = isAdministrator(getAuthSnapshot().user);

  return (
    <div
      className="shell"
      data-active-destination={activeDestination}
      data-active-module={activeModule}
    >
      <ShellHeader activeModule={activeModule} isAdministrator={administrator} />
      <div className="shell-body">
        {administrator && activeModule === "administration" ? (
          <AdministrationRail activeDestination={activeDestination} />
        ) : null}
        <main className="shell-content" aria-label="Authenticated content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
