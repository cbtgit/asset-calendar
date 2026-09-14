import { afterEach, expect, it, vi } from "vite-plus/test";
import * as auth from "@/api/auth";
import { Route as AuthenticatedRoute } from "./_authenticated";
import { Route as GroupsRoute } from "./_authenticated/groups";
import { Route as AuthenticatedIndexRoute } from "./_authenticated/index";
import { Route as SignInRoute } from "./sign-in";

const runBeforeLoad = (route: { options: { beforeLoad?: unknown } }) => {
  if (typeof route.options.beforeLoad !== "function") {
    throw new Error("Expected a route guard.");
  }
  return Reflect.apply(route.options.beforeLoad, undefined, [{}]);
};

afterEach(() => vi.restoreAllMocks());

it("gates the authenticated route layout until authentication is known", async () => {
  vi.spyOn(auth, "ensureAuthContextReady").mockResolvedValue();
  vi.spyOn(auth, "getAuthSnapshot").mockReturnValue({ status: "loading", user: null });

  await expect(runBeforeLoad(AuthenticatedRoute)).rejects.toMatchObject({
    options: { to: "/sign-in" },
  });
});

it("redirects an unavailable tenant context away from protected content", async () => {
  vi.spyOn(auth, "ensureAuthContextReady").mockResolvedValue();
  vi.spyOn(auth, "getAuthSnapshot").mockReturnValue({ status: "unavailable", user: null });

  await expect(runBeforeLoad(AuthenticatedRoute)).rejects.toMatchObject({
    options: { to: "/unavailable" },
  });
});

it("keeps the groups destination administrator-only", async () => {
  vi.spyOn(auth, "getAuthSnapshot").mockReturnValue({
    status: "authenticated",
    user: { role: "regular" } as auth.AuthUser,
  });

  await expect(runBeforeLoad(GroupsRoute)).rejects.toMatchObject({
    options: { to: "/calendar" },
  });
});

it("allows administrators through the groups guard", async () => {
  vi.spyOn(auth, "getAuthSnapshot").mockReturnValue({
    status: "authenticated",
    user: { role: "administrator" } as auth.AuthUser,
  });

  await expect(runBeforeLoad(GroupsRoute)).resolves.toBeUndefined();
});

it("protects nested groups routes through the groups layout guard", async () => {
  vi.spyOn(auth, "getAuthSnapshot").mockReturnValue({
    status: "authenticated",
    user: { role: "regular" } as auth.AuthUser,
  });

  await expect(runBeforeLoad(GroupsRoute)).rejects.toMatchObject({
    options: { to: "/calendar" },
  });
});

it("does not treat users without an administrator role as administrators", async () => {
  vi.spyOn(auth, "getAuthSnapshot").mockReturnValue({
    status: "authenticated",
    user: {} as auth.AuthUser,
  });

  await expect(runBeforeLoad(GroupsRoute)).rejects.toMatchObject({
    options: { to: "/calendar" },
  });
});

it("redirects the authenticated index to the calendar", async () => {
  await expect(
    Promise.resolve().then(() => runBeforeLoad(AuthenticatedIndexRoute)),
  ).rejects.toMatchObject({
    options: { to: "/calendar" },
  });
});

it("redirects authenticated users away from sign-in", async () => {
  vi.spyOn(auth, "ensureAuthReady").mockResolvedValue();
  vi.spyOn(auth, "getAuthSnapshot").mockReturnValue({
    status: "authenticated",
    user: {} as auth.AuthUser,
  });

  await expect(runBeforeLoad(SignInRoute)).rejects.toMatchObject({
    options: { to: "/" },
  });
});
