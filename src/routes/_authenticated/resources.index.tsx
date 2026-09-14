import { createFileRoute } from "@tanstack/react-router";
import { ResourceDirectory } from "@/components/resource-directory";

export const Route = createFileRoute("/_authenticated/resources/")({
  component: ResourcesIndexPage,
});

function ResourcesIndexPage() {
  return (
    <>
      <p className="eyebrow">Administration</p>
      <h1>Resources</h1>
      <ResourceDirectory />
    </>
  );
}
