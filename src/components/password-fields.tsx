import { AuthField } from "./auth-field";
import { PASSWORD_MIN_LENGTH } from "@/api/auth";

type PasswordFieldsProps = {
  confirmation: string;
  onConfirmationChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  password: string;
};

export function PasswordFields({
  confirmation,
  onConfirmationChange,
  onPasswordChange,
  password,
}: PasswordFieldsProps) {
  return (
    <>
      <AuthField
        id="setup-password"
        label="Password"
        hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={PASSWORD_MIN_LENGTH}
        required
        value={password}
        onChange={(event) => onPasswordChange(event.target.value)}
      />
      <AuthField
        id="setup-password-confirmation"
        label="Confirm password"
        name="passwordConfirmation"
        type="password"
        autoComplete="new-password"
        required
        value={confirmation}
        onChange={(event) => onConfirmationChange(event.target.value)}
      />
    </>
  );
}
