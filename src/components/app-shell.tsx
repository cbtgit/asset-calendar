import { HealthStatus } from "./health-status";
import "../App.css";
import { signOut } from "@/api/auth";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "@tanstack/react-router";

export function AppShell() {
  const auth = useAuth();
  const navigate = useNavigate();

  if (auth.status !== "authenticated") return null;

  return (
    <main className="shell">
      <p className="eyebrow">Asset Calendar</p>
      <h1>Keep important date in view.</h1>
      <p className="intro">
        A simple home for tracking assets, renewals, and the moments that keep your plans moving.
      </p>
      <HealthStatus />
      <button
        type="button"
        onClick={() => {
          signOut();
          void navigate({ to: "/sign-in", replace: true });
        }}
      >
        Sign out
      </button>
    </main>
  );
}
