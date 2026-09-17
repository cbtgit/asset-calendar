import { Link } from "@tanstack/react-router";
import { Loading } from "@/components/base/Loading";
import { useResourcesQuery } from "@/hooks/use-resources";
import { formatMinorUnitsForDisplay } from "@/lib/money";

export function ResourceDirectory() {
  const resources = useResourcesQuery();

  if (resources.isPending) return <Loading className="loading-page" />;
  if (resources.error) {
    return <p role="alert">Unable to load resources: {resources.error.message}</p>;
  }
  if (resources.data.length === 0) {
    return <p className="resources-empty">No resources have been created yet.</p>;
  }

  return (
    <ul className="resources-list">
      {resources.data.map((resource) => (
        <li className="resource-row" key={resource.id}>
          <div className="resource-name">
            <span className="resource-label">Resource</span>
            <strong>{resource.name}</strong>
            {resource.archived_at ? <p>Archived</p> : null}
          </div>
          <div className="resource-rate">
            <span className="resource-label">Hourly price</span>
            <span>{formatMinorUnitsForDisplay(resource.base_rate_minor_units)}</span>
          </div>
          <Link
            className="resource-edit"
            to="/administration/resources/$resourceId/edit"
            params={{ resourceId: resource.id }}
            aria-label={`Edit ${resource.name}`}
          >
            Edit
          </Link>
        </li>
      ))}
    </ul>
  );
}
