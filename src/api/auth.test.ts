import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "./client";
import { ensureAuthContextReady, getAuthSnapshot, signOut } from "./auth";
import { AppError } from "./errors";

beforeEach(() => {
  signOut();
});

afterEach(() => {
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
