import type { FormEvent, RefObject } from "react";
import { GroupFormFields } from "./group-form-fields";

type GroupFormViewProps = {
  mode: "create" | "edit";
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
};

export function GroupFormView(props: GroupFormViewProps) {
  return (
    <section className="group-form-surface" aria-labelledby="group-form-title">
      <p className="eyebrow">Administration</p>
      <h1 id="group-form-title">{props.mode === "create" ? "New group" : "Edit group"}</h1>
      <GroupFormFields
        name={props.name}
        nameRef={props.nameRef}
        pending={props.pending}
        validationError={props.validationError}
        conflictError={props.conflictError}
        serverError={props.serverError}
        announcement={props.announcement}
        submit={props.submit}
        onChange={props.onChange}
        onCancel={props.onCancel}
        mode={props.mode}
      />
    </section>
  );
}
