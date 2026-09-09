import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { authErrorMessage, signIn } from "@/api/auth";
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

export function SignInForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const mutation = useMutation({
    mutationFn: () => signIn(email.trim(), password),
    onSuccess,
  });

  return (
    <form
      className="auth-form"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <label htmlFor="sign-in-email">
        Email
        <input
          id="sign-in-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label htmlFor="sign-in-password">
        Password
        <input
          id="sign-in-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {mutation.isError ? (
        <p className="auth-error" role="alert" aria-live="assertive">
          {authErrorMessage(mutation.error, "sign-in")}
        </p>
      ) : null}
      <button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
