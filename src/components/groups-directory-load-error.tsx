export function GroupsDirectoryLoadError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => unknown;
}) {
  return (
    <section className="groups-directory-state" aria-live="polite">
      <p role="alert">Unable to load groups: {message}</p>
      <button type="button" onClick={() => void onRetry()}>
        Retry
      </button>
    </section>
  );
}
