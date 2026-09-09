import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "./client";
import { ensureAuthContextReady, getAuthSnapshot, setUnauthorizedRedirect, signOut } from "./auth";
import { AppError } from "./errors";

beforeEach(() => {
  signOut();
});

afterEach(() => {
  setUnauthorizedRedirect(undefined);
  signOut();
  vi.restoreAllMocks();
});

it("marks invalid unauthenticated contexts as unavailable", async () => {
  const authRefresh = vi.fn().mockRejectedValue(new AppError("not-found", "Missing tenant host"));
  vi.spyOn(pocketbase, "collection").mockReturnValue({ authRefresh } as never);

  await ensureAuthContextReady();

  expect(authRefresh).toHaveBeenCalledTimes(1);
  expect(getAuthSnapshot().status).toBe("unavailable");
});

it("keeps valid unauthenticated contexts on the sign-in path", async () => {
  const authRefresh = vi.fn().mockRejectedValue(new AppError("unauthorized", "Missing auth token"));
  vi.spyOn(pocketbase, "collection").mockReturnValue({ authRefresh } as never);

  await ensureAuthContextReady();

  expect(authRefresh).toHaveBeenCalledTimes(1);
  expect(getAuthSnapshot().status).toBe("unauthenticated");
});

it("clears auth state and redirects after a protected request is rejected", () => {
  const redirect = vi.fn();
  const user = {
    id: "user-1",
    collectionId: "users",
    collectionName: "users",
    email: "person@example.test",
  };

  setUnauthorizedRedirect(redirect);
  pocketbase.authStore.save("token", user);
  pocketbase.afterSend?.(new Response(null, { status: 401 }), {});

  expect(pocketbase.authStore.isValid).toBe(false);
  expect(pocketbase.authStore.model).toBeNull();
  expect(pocketbase.authStore.token).toBe("");
  expect(redirect).toHaveBeenCalledOnce();
});

it("does not treat authentication requests as protected-request failures", () => {
  const redirect = vi.fn();
  const response = new Response(null, { status: 401 });
  Object.defineProperty(response, "url", {
    value: "http://127.0.0.1:8090/api/collections/users/auth-with-password",
  });

  setUnauthorizedRedirect(redirect);
  pocketbase.afterSend?.(response, {});

  expect(redirect).not.toHaveBeenCalled();
});

it("refreshes a valid persisted auth state during startup", async () => {
  vi.resetModules();
  const reloadedClient = await import("./client");
  const user = {
    id: "persisted-user",
    collectionId: "users",
    collectionName: "users",
    email: "person@example.test",
  };
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const token = `header.${payload}.signature`;
  reloadedClient.pocketbase.authStore.save(token, user);

  const reloadedAuth = await import("./auth");
  const authRefresh = vi.fn().mockResolvedValue({ record: user });
  vi.spyOn(reloadedClient.pocketbase, "collection").mockReturnValue({ authRefresh } as never);

  try {
    await reloadedAuth.ensureAuthReady();

    expect(authRefresh).toHaveBeenCalledOnce();
    expect(reloadedAuth.getAuthSnapshot()).toMatchObject({ status: "authenticated", user });
  } finally {
    reloadedAuth.signOut();
    reloadedClient.pocketbase.authStore.clear();
  }
});

it("clears an expired persisted auth state before protected routing", async () => {
  vi.resetModules();
  const reloadedClient = await import("./client");
  reloadedClient.pocketbase.authStore.save(
    `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 1 }))}.signature`,
    {
      id: "expired-user",
      collectionId: "users",
      collectionName: "users",
      email: "person@example.test",
    },
  );

  const reloadedAuth = await import("./auth");

  expect(reloadedAuth.getAuthSnapshot()).toEqual({ status: "unauthenticated", user: null });
  expect(reloadedClient.pocketbase.authStore.token).toBe("");
  expect(reloadedClient.pocketbase.authStore.model).toBeNull();
});
