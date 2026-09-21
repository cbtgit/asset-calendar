import "../App.css";
import { getAuthSnapshot, isAdministrator } from "@/api/auth";
import { Outlet, useMatches, useRouterState } from "@tanstack/react-router";
import { AdministrationRail } from "./administration/administration-rail";
import { ShellHeader } from "./shell-header";

export type ActiveModule = "calendar" | "administration";

export function AppShell() {
  const matches = useMatches();
  const { href } = useRouterState({ select: (state) => state.location });

  const activeModule: ActiveModule = matches.some(
    (match) => match.routeId === "/_authenticated/administration",
  )
    ? "administration"
    : "calendar";
  const administrator = isAdministrator(getAuthSnapshot().user);

  return (
    <div className="shell" data-active-module={activeModule}>
      <ShellHeader
        activeModule={activeModule}
        isAdministrator={administrator}
        navigationKey={href}
      />
      <div className="shell-body">
        {administrator && activeModule === "administration" ? <AdministrationRail /> : null}
        {activeModule === "calendar" ? (
          <div className="shell-content">
            <Outlet />
          </div>
        ) : (
          <main className="shell-content" aria-label="Authenticated content">
            <Outlet />
          </main>
        )}
      </div>
    </div>
  );
}
