import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { setupPassword } from "@/api/auth";
import { AuthErrorMessage } from "./auth-error-message";
import { AuthSubmitButton } from "./auth-submit-button";
import { PasswordFields } from "./password-fields";
import "./auth-page.css";

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
      <PasswordFields
        password={password}
        confirmation={confirmation}
        onPasswordChange={setPassword}
        onConfirmationChange={setConfirmation}
      />
      <AuthErrorMessage error={mutation.error} message={validationError} operation="setup" />
      <AuthSubmitButton
        label="Save password"
        pending={mutation.isPending}
        pendingLabel="Saving password…"
      />
    </form>
  );
}
