import "../App.css";
import { Outlet, useRouterState } from "@tanstack/react-router";

export type ActiveDestination = "calendar" | "groups";

export function getActiveDestination(pathname: string): ActiveDestination {
  return pathname.startsWith("/groups") ? "groups" : "calendar";
}

export function AppShell() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const activeDestination = getActiveDestination(pathname);
  return (
    <div className="shell" data-active-destination={activeDestination}>
      <header>
        <p className="eyebrow">Asset Calendar</p>
      </header>
      <nav aria-label="Primary navigation" data-active-destination={activeDestination} />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
