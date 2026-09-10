import "../App.css";
import { signOut } from "@/api/auth";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";

export type ActiveDestination = "calendar" | "groups";

// oxlint-disable-next-line eslint(react/only-export-components)
export function getActiveDestination(pathname: string): ActiveDestination {
  return pathname.startsWith("/groups") ? "groups" : "calendar";
}

export function AppShell() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const activeDestination = getActiveDestination(pathname);
  return (
    <div className="shell" data-active-destination={activeDestination}>
      <header>
        <p className="eyebrow">Asset Calendar</p>
        <button
          type="button"
          onClick={() => {
            signOut();
            void navigate({ to: "/sign-in", replace: true });
          }}
        >
          Sign out
        </button>
      </header>
      <nav aria-label="Primary navigation" data-active-destination={activeDestination} />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
