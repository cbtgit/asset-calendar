import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ResourceDirectory } from "@/components/administration/resources/resource-directory";
import { Button } from "@/components/base/Button";
import "./administration.resources.css";

export const Route = createFileRoute("/_authenticated/administration/resources/")({
  component: ResourcesPage,
});

function ResourcesPage() {
  const navigate = useNavigate();

  return (
    <>
      <p className="eyebrow">Administration</p>
      <div className="resources-header">
        <div>
          <h1>Resources</h1>
          <p>Manage the resources available for bookings.</p>
        </div>
        <Button
          variant="primary"
          onClick={() => void navigate({ to: "/administration/resources/new" })}
        >
          New Resource
        </Button>
      </div>
      <ResourceDirectory />
    </>
  );
}
