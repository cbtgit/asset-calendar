import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import "../components/auth-page.css";

export const Route = createRootRoute({
  component: Outlet,
  notFoundComponent: () => (
    <main className="auth-page">
      <p className="eyebrow">Asset Calendar</p>
      <h1>Page not found</h1>
      <p>This application could not find that page.</p>
      <Link className="auth-link" to="/sign-in">
        Return to sign in
      </Link>
    </main>
  ),
});
