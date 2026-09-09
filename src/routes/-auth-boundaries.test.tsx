import { afterEach, expect, it, vi } from "vite-plus/test";
import * as auth from "@/api/auth";
import { Route as HomeRoute } from "./index";
import { Route as SignInRoute } from "./sign-in";

const runBeforeLoad = (route: { options: { beforeLoad?: unknown } }) => {
  if (typeof route.options.beforeLoad !== "function") {
    throw new Error("Expected a route guard.");
  }
  return Reflect.apply(route.options.beforeLoad, undefined, [{}]);
};

afterEach(() => vi.restoreAllMocks());

it("gates the protected home route until authentication is known", async () => {
  vi.spyOn(auth, "ensureAuthContextReady").mockResolvedValue();
  vi.spyOn(auth, "getAuthSnapshot").mockReturnValue({ status: "loading", user: null });

  await expect(runBeforeLoad(HomeRoute)).rejects.toMatchObject({
    options: { to: "/sign-in" },
  });
});

it("redirects an unavailable tenant context away from protected content", async () => {
  vi.spyOn(auth, "ensureAuthContextReady").mockResolvedValue();
  vi.spyOn(auth, "getAuthSnapshot").mockReturnValue({ status: "unavailable", user: null });

  await expect(runBeforeLoad(HomeRoute)).rejects.toMatchObject({
    options: { to: "/unavailable" },
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
