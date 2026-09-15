import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ResourceForm } from "@/components/administration/resources/resource-form";

export const Route = createFileRoute("/_authenticated/administration/resources/new")({
  component: NewResourcePage,
});

function NewResourcePage() {
  const navigate = useNavigate();

  return (
    <ResourceForm
      onCancel={() => void navigate({ to: "/administration/resources" })}
      onSuccess={() => void navigate({ to: "/administration/resources", replace: true })}
    />
  );
}
