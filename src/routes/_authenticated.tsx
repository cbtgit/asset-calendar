import { createFileRoute, redirect } from "@tanstack/react-router";
import { ensureAuthContextReady, getAuthSnapshot } from "@/api/auth";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    await ensureAuthContextReady();
    const status = getAuthSnapshot().status;
    if (status === "unavailable") throw redirect({ to: "/unavailable" });
    if (status !== "authenticated") throw redirect({ to: "/sign-in" });
  },
  component: AppShell,
});
