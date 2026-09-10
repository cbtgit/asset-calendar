export function GroupsDirectoryMutationError({ message }: { message: string }) {
  return (
    <p className="groups-directory-error" role="alert">
      Unable to delete group: {message}
    </p>
  );
}
