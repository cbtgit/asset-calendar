import { signOut } from "@/api/auth";
import { useNavigate } from "@tanstack/react-router";

export function ShellSignOut() {
  const navigate = useNavigate();

  return (
    <button
      className="shell-sign-out"
      type="button"
      onClick={() => {
        signOut();
        void navigate({ to: "/sign-in", replace: true });
      }}
    >
      Sign out
    </button>
  );
}
