import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  INVALID_SETUP_LINK_MESSAGE,
  PASSWORD_MIN_LENGTH,
  PASSWORD_TOO_SHORT_MESSAGE,
  setupPassword,
} from "@/api/auth";
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
      setValidationError(INVALID_SETUP_LINK_MESSAGE);
      return;
    }
    if (!password || password !== confirmation) {
      setValidationError("Enter matching passwords to continue.");
      return;
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      setValidationError(PASSWORD_TOO_SHORT_MESSAGE);
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
