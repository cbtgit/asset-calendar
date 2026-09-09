import { createFileRoute } from "@tanstack/react-router";
import { UnavailablePage } from "@/components/unavailable-page";

export const Route = createFileRoute("/unavailable")({
  component: UnavailablePage,
});
