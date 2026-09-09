import { createFileRoute, redirect } from "@tanstack/react-router";
import { ensureAuthReady, getAuthSnapshot } from "@/api/auth";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    await ensureAuthReady();
    const status = getAuthSnapshot().status;
    if (status === "unavailable") throw redirect({ to: "/unavailable" });
    if (status !== "authenticated") throw redirect({ to: "/sign-in" });
  },
  component: AppShell,
});
