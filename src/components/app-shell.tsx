import { HealthStatus } from "./health-status";
import "../App.css";

export function AppShell() {
  return (
    <main className="shell">
      <p className="eyebrow">Asset Calendar</p>
      <h1>Keep every important date in view.</h1>
      <p className="intro">
        A simple home for tracking assets, renewals, and the moments that keep your plans moving.
      </p>
      <HealthStatus />
    </main>
  );
}
