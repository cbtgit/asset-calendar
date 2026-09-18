import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApplicationError } from "@/api/errors";
import type { User, UserCreate, UserRole, UserUpdate } from "@/api/users";
import { Loading } from "@/components/base/Loading";
import { useGroupsQuery } from "@/hooks/use-groups";
import {
  useCreateUserMutation,
  useResendUserInvitationMutation,
  useUpdateUserMutation,
} from "@/hooks/use-users";
import { Button } from "@/components/base/Button";
import "./user-form.css";

type UserFormProps =
  | { mode: "create"; onCancel: () => void; onSuccess: () => void }
  | { mode: "edit"; user: User; onCancel: () => void; onSuccess: () => void };

function fieldError(message: string | undefined, id: string) {
  return message ? (
    <p id={id} className="user-form-error" role="alert">
      {message}
    </p>
  ) : null;
}

function validateName(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) return `Enter a ${label}.`;
  if (trimmed.length > 100) return `${label} must be 100 characters or fewer.`;
  return undefined;
}

function validateEmail(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "Enter an email address.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "Enter a valid email address.";
  return undefined;
}

export function UserForm(props: UserFormProps) {
  const editing = props.mode === "edit";
  const user = editing ? props.user : undefined;
  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [group, setGroup] = useState(user?.group ?? "");
  const [role, setRole] = useState<UserRole>(user?.role ?? "regular");
  const [active, setActive] = useState(user?.active ?? true);
  const [validationError, setValidationError] = useState<string>();
  const firstNameRef = useRef<HTMLInputElement>(null);
  const groups = useGroupsQuery();
  const createMutation = useCreateUserMutation();
  const updateMutation = useUpdateUserMutation();
  const resendMutation = useResendUserInvitationMutation();
  const mutation = editing ? updateMutation : createMutation;
  const conflict =
    mutation.error instanceof ApplicationError &&
    mutation.error.message.toLowerCase().includes("email_already_exists");

  useEffect(() => {
    firstNameRef.current?.focus();
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(undefined);
    const nameError = validateName(firstName, "first name") ?? validateName(lastName, "last name");
    const emailError = editing ? undefined : validateEmail(email);
    if (nameError || emailError || !group) {
      setValidationError(nameError ?? emailError ?? "Choose a group.");
      firstNameRef.current?.focus();
      return;
    }

    if (editing) {
      const input: UserUpdate = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        group,
        role,
        active,
      };
      updateMutation.mutate({ id: props.user.id, input }, { onSuccess: props.onSuccess });
    } else {
      const input: UserCreate = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim().toLowerCase(),
        group,
        role,
      };
      createMutation.mutate(input, { onSuccess: props.onSuccess });
    }
  }

  if (groups.isPending) return <Loading />;
  if (groups.isError) return <p role="alert">Unable to load groups: {groups.error.message}</p>;

  const error =
    validationError ?? (conflict ? "A user with this email already exists." : undefined);
  const pending = mutation.isPending || resendMutation.isPending;

  return (
    <section className="user-form-surface" aria-labelledby="user-form-title">
      <p className="eyebrow">Administration</p>
      <h1 id="user-form-title">{editing ? "Edit user" : "New user"}</h1>
      <form className="user-form" onSubmit={submit} noValidate>
        <div className="user-form-grid">
          <label>
            First name
            <input
              ref={firstNameRef}
              value={firstName}
              maxLength={100}
              disabled={pending}
              onChange={(event) => setFirstName(event.target.value)}
              aria-invalid={Boolean(error)}
            />
          </label>
          <label>
            Last name
            <input
              value={lastName}
              maxLength={100}
              disabled={pending}
              onChange={(event) => setLastName(event.target.value)}
              aria-invalid={Boolean(error)}
            />
          </label>
          <label className="user-form-wide">
            Email
            <input
              type="email"
              value={email}
              disabled={editing || pending}
              onChange={(event) => setEmail(event.target.value)}
              aria-describedby={conflict ? "user-form-error" : undefined}
              aria-invalid={conflict}
            />
          </label>
          <label>
            Group
            <select
              value={group}
              disabled={pending}
              onChange={(event) => setGroup(event.target.value)}
            >
              <option value="">Choose a group</option>
              {groups.data.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Role
            <select
              value={role}
              disabled={pending}
              onChange={(event) => setRole(event.target.value as UserRole)}
            >
              <option value="regular">Regular user</option>
              <option value="administrator">Administrator</option>
            </select>
          </label>
          {editing ? (
            <label className="user-form-checkbox">
              <input
                type="checkbox"
                checked={active}
                disabled={pending}
                onChange={(event) => setActive(event.target.checked)}
              />
              Active user
            </label>
          ) : null}
        </div>
        {fieldError(error, "user-form-error")}
        {mutation.isError && !error ? (
          <p className="user-form-error" role="alert">
            We could not save this user. Try again.
          </p>
        ) : null}
        {resendMutation.isError ? (
          <p className="user-form-error" role="alert">
            We could not resend the invitation. Try again.
          </p>
        ) : null}
        <p className="user-form-announcement" aria-live="polite">
          {resendMutation.isSuccess ? "Invitation resent." : ""}
        </p>
        <div className="user-form-actions">
          <Button type="button" disabled={pending} onClick={props.onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving…" : editing ? "Save" : "Create user"}
          </Button>
          {props.mode === "edit" && props.user.password_setup_pending && props.user.active ? (
            <Button
              type="button"
              disabled={pending}
              onClick={() => resendMutation.mutate(props.user.id)}
            >
              Resend invitation
            </Button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
