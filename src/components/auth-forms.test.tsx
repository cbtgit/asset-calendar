import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import * as auth from "@/api/auth";
import { AppError } from "@/api/errors";
import type { AuthUser } from "@/api/auth";
import { SetupPasswordForm } from "./setup-password-form";
import { SignInForm } from "./sign-in-form";

function renderWithQueryClient(element: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);
}

const user = {} as AuthUser;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("does not show an error before sign-in is attempted", () => {
  renderWithQueryClient(<SignInForm onSuccess={vi.fn()} />);

  expect(screen.queryByRole("alert")).toBeNull();
});

it("submits sign-in with labeled fields and disables the form while pending", async () => {
  let resolve: (value: AuthUser) => void = () => {};
  vi.spyOn(auth, "signIn").mockReturnValue(
    new Promise<AuthUser>((promiseResolve) => {
      resolve = promiseResolve;
    }),
  );
  const onSuccess = vi.fn();

  renderWithQueryClient(<SignInForm onSuccess={onSuccess} />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.test" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
  fireEvent.submit(screen.getByLabelText("Email").closest("form")!);

  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "Signing in…" }) as HTMLButtonElement).disabled,
    ).toBe(true),
  );
  resolve(user);
  await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
});

it("shows a generic sign-in error", async () => {
  vi.spyOn(auth, "signIn").mockRejectedValue(
    new AppError("unauthorized", "raw PocketBase details"),
  );

  renderWithQueryClient(<SignInForm onSuccess={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.test" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
  fireEvent.submit(screen.getByLabelText("Email").closest("form")!);

  const error = await screen.findByRole("alert");
  expect(error.textContent).toContain("Unable to sign in");
  expect(error.textContent).not.toContain("raw PocketBase details");
});

it("submits password setup and rejects missing or mismatched credentials locally", async () => {
  const setup = vi.spyOn(auth, "setupPassword").mockResolvedValue(user);
  const onSuccess = vi.fn();

  renderWithQueryClient(<SetupPasswordForm token="token" onSuccess={onSuccess} />);
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret12" } });
  fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "different" } });
  fireEvent.submit(screen.getByLabelText("Password").closest("form")!);

  expect(screen.getByRole("alert").textContent).toContain("matching passwords");
  expect(setup).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText("Confirm password"), {
    target: { value: "secret12" },
  });
  fireEvent.submit(screen.getByLabelText("Password").closest("form")!);
  await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
  expect(setup).toHaveBeenCalledWith("token", "secret12");
});

it("rejects short passwords locally with a specific message", () => {
  const setup = vi.spyOn(auth, "setupPassword");

  renderWithQueryClient(<SetupPasswordForm token="token" onSuccess={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "short" } });
  fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "short" } });
  fireEvent.submit(screen.getByLabelText("Password").closest("form")!);

  expect(screen.getByRole("alert").textContent).toContain("at least 8 characters");
  expect(setup).not.toHaveBeenCalled();
});

it("maps PocketBase password-length validation to a specific message", async () => {
  const cause = Object.assign(new Error("The submitted data is invalid."), {
    status: 400,
    data: {
      password: {
        code: "validation_min_text_constraint",
        message: "Must be at least 8 characters long.",
      },
    },
  });
  vi.spyOn(auth, "setupPassword").mockRejectedValue(cause);

  renderWithQueryClient(<SetupPasswordForm token="token" onSuccess={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "longpassword" } });
  fireEvent.change(screen.getByLabelText("Confirm password"), {
    target: { value: "longpassword" },
  });
  fireEvent.submit(screen.getByLabelText("Password").closest("form")!);

  expect((await screen.findByRole("alert")).textContent).toContain("at least 8 characters");
});

it("keeps other setup validation failures as invitation errors", async () => {
  vi.spyOn(auth, "setupPassword").mockRejectedValue(
    new AppError("validation", "Invalid or expired invitation."),
  );

  renderWithQueryClient(<SetupPasswordForm token="token" onSuccess={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "longpassword" } });
  fireEvent.change(screen.getByLabelText("Confirm password"), {
    target: { value: "longpassword" },
  });
  fireEvent.submit(screen.getByLabelText("Password").closest("form")!);

  expect((await screen.findByRole("alert")).textContent).toContain("Ask an administrator");
});

it("shows a generic error for malformed password setup links", () => {
  const setup = vi.spyOn(auth, "setupPassword");

  renderWithQueryClient(<SetupPasswordForm token="" onSuccess={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "longpassword" } });
  fireEvent.change(screen.getByLabelText("Confirm password"), {
    target: { value: "longpassword" },
  });
  fireEvent.submit(screen.getByLabelText("Password").closest("form")!);

  expect(screen.getByRole("alert").textContent).toContain("invalid or has expired");
  expect(setup).not.toHaveBeenCalled();
});
