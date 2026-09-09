import { createFileRoute, redirect } from "@tanstack/react-router";
import { ensureAuthReady, getAuthSnapshot } from "@/api/auth";
import { SignInPage } from "@/components/sign-in-form";
import "../components/auth-page.css";

export const Route = createFileRoute("/sign-in")({
  beforeLoad: async () => {
    await ensureAuthReady();
    if (getAuthSnapshot().status === "authenticated") {
      throw redirect({ to: "/" });
    }
  },
  component: SignInPage,
});
