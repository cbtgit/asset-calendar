import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { resourcesQueryOptions } from "@/api/resources";
import { ResourceDirectory } from "@/components/administration/resources/resource-directory";
import { Button } from "@/components/base/Button";
import { queryClient } from "@/lib/query-client";
import "./administration.resources.css";

export const Route = createFileRoute("/_authenticated/administration/resources/")({
  loader: () => {
    void queryClient.prefetchQuery(resourcesQueryOptions()).catch(() => undefined);
  },
  component: ResourcesPage,
});

function focusHeading(heading: HTMLHeadingElement | null) {
  heading?.focus();
}

function ResourcesPage() {
  const navigate = useNavigate();
  return (
    <>
      <p className="eyebrow">Administration</p>
      <div className="resources-header">
        <div>
          <h1 ref={focusHeading} tabIndex={-1}>
            Resources
          </h1>
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
