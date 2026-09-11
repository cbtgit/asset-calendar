import type { FormEvent, RefObject } from "react";

type GroupFormFieldsProps = {
  name: string;
  nameRef: RefObject<HTMLInputElement | null>;
  pending: boolean;
  validationError?: string;
  conflictError?: string;
  serverError: boolean;
  announcement: string;
  submit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (value: string) => void;
  onCancel: () => void;
  mode: "create" | "edit";
};

export function GroupFormFields({
  name,
  nameRef,
  pending,
  validationError,
  conflictError,
  serverError,
  announcement,
  submit,
  onChange,
  onCancel,
  mode,
}: GroupFormFieldsProps) {
  const fieldError = validationError ?? conflictError;
  return (
    <form className="group-form" onSubmit={submit} noValidate>
      <label htmlFor="group-name">Group name</label>
      <input
        ref={nameRef}
        id="group-name"
        name="name"
        value={name}
        maxLength={200}
        aria-invalid={Boolean(fieldError)}
        aria-describedby={fieldError ? "group-name-error" : undefined}
        onChange={(event) => onChange(event.target.value)}
        disabled={pending}
      />
      {renderErrors(fieldError, serverError)}
      {renderActions(pending, mode, onCancel)}
      <p className="group-form-announcement" aria-live="polite">
        {announcement}
      </p>
    </form>
  );
}

function renderErrors(fieldError: string | undefined, serverError: boolean) {
  return (
    <>
      {fieldError ? (
        <p id="group-name-error" className="group-form-error" role="alert">
          {fieldError}
        </p>
      ) : null}
      {serverError ? (
        <p className="group-form-error" role="alert">
          We could not save this group. Try again.
        </p>
      ) : null}
    </>
  );
}

function renderActions(pending: boolean, mode: "create" | "edit", onCancel: () => void) {
  return (
    <div className="group-form-actions">
      <button type="button" onClick={onCancel} disabled={pending}>
        Cancel
      </button>
      <button type="submit" disabled={pending}>
        {pending ? "Saving…" : mode === "create" ? "Create group" : "Save changes"}
      </button>
    </div>
  );
}
