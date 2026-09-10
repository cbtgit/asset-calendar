import type { RecordAuthResponse, RecordModel } from "pocketbase";
import { pocketbase, setUnauthorizedHandler } from "./client";
import { toAppError, type ApplicationError } from "./errors";

export type AuthUser = RecordModel & {
  active?: boolean;
  email: string;
  first_name?: string;
  last_name?: string;
  password_setup_pending?: boolean;
  role?: "administrator" | "regular";
  tenant?: string;
};

export type AuthStatus = "authenticated" | "loading" | "unauthenticated" | "unavailable";

export type AuthSnapshot = {
  status: AuthStatus;
  user: AuthUser | null;
};

export function isAdministrator(user: AuthUser | null): boolean {
  return user?.role === "administrator";
}

const hasPersistedAuthState = Boolean(pocketbase.authStore.token || pocketbase.authStore.model);
if (!pocketbase.authStore.isValid && hasPersistedAuthState) {
  pocketbase.authStore.clear();
}

const initialSnapshot: AuthSnapshot = {
  status: pocketbase.authStore.isValid ? "loading" : "unauthenticated",
  user: (pocketbase.authStore.model as AuthUser | null) ?? null,
};

let snapshot = initialSnapshot;
let readyPromise: Promise<void> | undefined;
let unauthorizedRedirect: (() => void) | undefined;
const listeners = new Set<() => void>();

function publish(next: AuthSnapshot) {
  snapshot = next;
  for (const listener of listeners) listener();
}

function snapshotFromStore(status: AuthStatus): AuthSnapshot {
  return {
    status,
    user: (pocketbase.authStore.model as AuthUser | null) ?? null,
  };
}

pocketbase.authStore.onChange((_token, model) => {
  publish({
    status: model ? "authenticated" : "unauthenticated",
    user: (model as AuthUser | null) ?? null,
  });
});

setUnauthorizedHandler(() => {
  signOut();
  unauthorizedRedirect?.();
});

export function getAuthSnapshot(): AuthSnapshot {
  return snapshot;
}

export function subscribeToAuth(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function ensureAuthReady(): Promise<void> {
  if (snapshot.status !== "loading") return;
  readyPromise ??= pocketbase
    .collection<AuthUser>("users")
    .authRefresh()
    .then((response) => {
      publish({ status: "authenticated", user: response.record });
    })
    .catch((cause: unknown) => {
      const error = toAppError(cause);
      pocketbase.authStore.clear();
      publish(
        snapshotFromStore(
          error.kind === "not-found" || error.kind === "network" || error.kind === "server"
            ? "unavailable"
            : "unauthenticated",
        ),
      );
    })
    .then(() => undefined);

  await readyPromise;
}

export async function ensureAuthContextReady(): Promise<void> {
  await ensureAuthReady();
  if (snapshot.status !== "unauthenticated") return;

  try {
    await pocketbase.collection<AuthUser>("users").authRefresh();
  } catch (cause) {
    const error = toAppError(cause);
    if (error.kind === "not-found" || error.kind === "network" || error.kind === "server") {
      publish(snapshotFromStore("unavailable"));
    }
  }
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  try {
    const response = await pocketbase
      .collection<AuthUser>("users")
      .authWithPassword(email, password);
    return response.record;
  } catch (cause) {
    throw toAppError(cause);
  }
}

export async function setupPassword(token: string, password: string): Promise<AuthUser> {
  try {
    const response = await pocketbase.send<RecordAuthResponse<AuthUser>>("/api/invitations/setup", {
      method: "POST",
      body: { token, password },
    });
    pocketbase.authStore.save(response.token, response.record);
    return response.record;
  } catch (cause) {
    throw toAppError(cause);
  }
}

export function signOut(): void {
  readyPromise = undefined;
  pocketbase.authStore.clear();
}

export function setUnauthorizedRedirect(handler: (() => void) | undefined): void {
  unauthorizedRedirect = handler;
}

export function authErrorMessage(error: unknown, purpose: "sign-in" | "setup"): string {
  const appError = toAppError(error) as ApplicationError;
  if (purpose === "setup") {
    return appError.kind === "network" || appError.kind === "server"
      ? "Password setup is currently unavailable. Try again later."
      : "We could not complete password setup. The link may be invalid or expired.";
  }

  return appError.kind === "network" || appError.kind === "server" || appError.kind === "not-found"
    ? "Sign-in is currently unavailable. Check the address and try again later."
    : "Unable to sign in. Check your email and password, then try again.";
}
