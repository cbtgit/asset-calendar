import { createFileRoute } from "@tanstack/react-router";
import { BillingExport } from "@/components/administration/billing/billing-export";

export const Route = createFileRoute("/_authenticated/administration/billing")({
  component: BillingPage,
});

function BillingPage() {
  return <BillingExport />;
}
