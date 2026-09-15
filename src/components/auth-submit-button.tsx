import { Button } from "./base/Button";

type AuthSubmitButtonProps = {
  label: string;
  pending: boolean;
  pendingLabel: string;
};

export function AuthSubmitButton({ label, pending, pendingLabel }: AuthSubmitButtonProps) {
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
