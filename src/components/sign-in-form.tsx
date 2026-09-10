import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { signIn } from "@/api/auth";
import { AuthField } from "./auth-field";
import { AuthErrorMessage } from "./auth-error-message";
import { AuthSubmitButton } from "./auth-submit-button";
import "./auth-page.css";

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
      <AuthField
        id="sign-in-email"
        label="Email"
        name="email"
        type="email"
        autoComplete="username"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <AuthField
        id="sign-in-password"
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <AuthErrorMessage error={mutation.error} operation="sign-in" />
      <AuthSubmitButton label="Sign in" pending={mutation.isPending} pendingLabel="Signing in…" />
    </form>
  );
}
