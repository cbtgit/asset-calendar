import { createRouter } from "@tanstack/react-router";
import { setUnauthorizedRedirect } from "./api/auth";
import { routeTree } from "./routeTree.gen";

export const router = createRouter({
  routeTree,
});

setUnauthorizedRedirect(() => {
  void router.navigate({ to: "/sign-in", replace: true });
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
