import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { authErrorMessage, setupPassword } from "@/api/auth";
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

export function SetupPasswordForm({ token, onSuccess }: { token: string; onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [validationError, setValidationError] = useState<string>();
  const mutation = useMutation({
    mutationFn: () => setupPassword(token, password),
    onSuccess,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(undefined);
    if (!token) {
      setValidationError(
        "We could not complete password setup. The link may be invalid or expired.",
      );
      return;
    }
    if (!password || password !== confirmation) {
      setValidationError("Enter matching passwords to continue.");
      return;
    }
    mutation.mutate();
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label htmlFor="setup-password">
        Password
        <input
          id="setup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <label htmlFor="setup-password-confirmation">
        Confirm password
        <input
          id="setup-password-confirmation"
          name="passwordConfirmation"
          type="password"
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
      </label>
      {validationError || mutation.isError ? (
        <p className="auth-error" role="alert" aria-live="assertive">
          {validationError ?? authErrorMessage(mutation.error, "setup")}
        </p>
      ) : null}
      <button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Saving password…" : "Save password"}
      </button>
    </form>
  );
}
