import { expect, it } from "vite-plus/test";
import { queryClient } from "./query-client";

it("uses conservative query and mutation defaults", () => {
  const defaults = queryClient.getDefaultOptions();

  expect(defaults.queries?.retry).toBe(1);
  expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
  expect(defaults.mutations?.retry).toBe(false);
});
