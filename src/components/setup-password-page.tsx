import { useNavigate, useSearch } from "@tanstack/react-router";
import { SetupPasswordForm } from "./setup-password-form";
import "./auth-page.css";

export function SetupPasswordPage() {
  const navigate = useNavigate();
  const { token } = useSearch({ from: "/setup-password" });

  return (
    <main className="auth-page">
      <p className="eyebrow">Asset Calendar</p>
      <h1>Set your password</h1>
      <p>Choose a password to finish setting up your account.</p>
      <SetupPasswordForm
        token={token}
        onSuccess={() => void navigate({ to: "/", replace: true })}
      />
    </main>
  );
}
