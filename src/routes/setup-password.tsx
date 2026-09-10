import { createFileRoute } from "@tanstack/react-router";
import { SetupPasswordPage } from "@/components/setup-password-page";

export const Route = createFileRoute("/setup-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: SetupPasswordPage,
});
