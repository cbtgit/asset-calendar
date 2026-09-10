type AuthSubmitButtonProps = {
  label: string;
  pending: boolean;
  pendingLabel: string;
};

export function AuthSubmitButton({ label, pending, pendingLabel }: AuthSubmitButtonProps) {
  return (
    <button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}
