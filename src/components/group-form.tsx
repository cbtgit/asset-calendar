import { useGroupForm, type GroupFormProps } from "@/hooks/use-group-form";
import { GroupFormView } from "./group-form-view";
import "./group-form.css";

export function GroupForm(props: GroupFormProps) {
  const form = useGroupForm(props);

  return (
    <GroupFormView
      mode={props.mode}
      name={form.name}
      nameRef={form.nameRef}
      pending={form.mutation.isPending}
      validationError={form.validationError}
      conflictError={form.conflictError}
      serverError={Boolean(form.mutation.error && !form.conflictError)}
      announcement={form.announcement}
      submit={form.submit}
      onChange={form.onChange}
      onCancel={props.onCancel}
    />
  );
}
