import { useHealthQuery } from "@/hooks/use-health-query";

export function HealthStatus() {
  const health = useHealthQuery();

  if (health.isPending) {
    return <p role="status">Checking PocketBase connection…</p>;
  }

  if (health.isError) {
    return (
      <section aria-live="polite">
        <p role="alert">Unable to connect to PocketBase: {health.error.message}</p>
        <button type="button" onClick={() => void health.refetch()}>
          Retry
        </button>
      </section>
    );
  }

  return (
    <section aria-live="polite">
      <p role="status">Connected</p>
      <p>{health.data.message}</p>
    </section>
  );
}
