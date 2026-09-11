import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApplicationError } from "@/api/errors";
import { useCreateGroupMutation, useRenameGroupMutation } from "./use-groups";

export type GroupFormProps =
  | { mode: "create"; initialName?: string; onCancel: () => void; onSuccess: () => void }
  | {
      mode: "edit";
      groupId: string;
      initialName: string;
      onCancel: () => void;
      onSuccess: () => void;
    };

function validateName(value: string): string | undefined {
  const trimmedName = value.trim();
  if (!trimmedName) return "Enter a group name.";
  if (trimmedName.length > 200) return "Group names must be 200 characters or fewer.";
  return undefined;
}

export function useGroupForm(props: GroupFormProps) {
  const [name, setName] = useState(props.initialName ?? "");
  const [validationError, setValidationError] = useState<string>();
  const [announcement, setAnnouncement] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const createMutation = useCreateGroupMutation();
  const renameMutation = useRenameGroupMutation();
  const mutation = props.mode === "create" ? createMutation : renameMutation;
  const conflictError =
    mutation.error instanceof ApplicationError && mutation.error.kind === "conflict"
      ? "A group with this name already exists."
      : undefined;

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(undefined);
    setAnnouncement("");
    const trimmedName = name.trim();
    const nameError = validateName(name);
    if (nameError) {
      setValidationError(nameError);
      nameRef.current?.focus();
      return;
    }

    const onSuccess = () => {
      setAnnouncement(props.mode === "create" ? "Group created." : "Group renamed.");
      window.setTimeout(props.onSuccess, 0);
    };
    if (props.mode === "create") createMutation.mutate({ name: trimmedName }, { onSuccess });
    else renameMutation.mutate({ id: props.groupId, input: { name: trimmedName } }, { onSuccess });
  }

  return {
    name,
    nameRef,
    mutation,
    validationError,
    conflictError,
    announcement,
    submit,
    onChange: (value: string) => {
      setName(value);
      setValidationError(undefined);
    },
  };
}
