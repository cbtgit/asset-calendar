import { useNavigate } from "@tanstack/react-router";
import { SignInForm } from "./sign-in-form";
import "./auth-page.css";

export function SignInPage() {
  const navigate = useNavigate();

  return (
    <main className="auth-page">
      <p className="eyebrow">Asset Calendar</p>
      <h1>Sign in</h1>
      <p>Use your work account to continue.</p>
      <SignInForm onSuccess={() => void navigate({ to: "/", replace: true })} />
    </main>
  );
}
