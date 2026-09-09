import { Link } from "@tanstack/react-router";
import "./auth-page.css";

export function UnavailablePage() {
  return (
    <main className="auth-page">
      <p className="eyebrow">Asset Calendar</p>
      <h1>Application unavailable</h1>
      <p>
        This application is not available at this address. Check the address and try again later.
      </p>
      <Link className="auth-link" to="/sign-in">
        Return to sign in
      </Link>
    </main>
  );
}
