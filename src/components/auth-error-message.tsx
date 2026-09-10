import { authErrorMessage } from "@/api/auth";

type AuthOperation = "sign-in" | "setup";

type AuthErrorMessageProps = {
  error?: unknown;
  message?: string;
  operation: AuthOperation;
};

export function AuthErrorMessage({ error, message, operation }: AuthErrorMessageProps) {
  const content = message ?? (error === undefined ? undefined : authErrorMessage(error, operation));
  if (content === undefined) return null;

  return (
    <p className="auth-error" role="alert" aria-live="assertive">
      {content}
    </p>
  );
}
