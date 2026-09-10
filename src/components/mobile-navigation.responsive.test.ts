/// <reference types="node" />

import { readFileSync } from "node:fs";
import { expect, it } from "vite-plus/test";

it("keeps the mobile navigation CSS contract below the 768px breakpoint", () => {
  const stylesheet = readFileSync("src/App.css", "utf8");

  expect(stylesheet).toContain("@media (max-width: 767px)");
  expect(stylesheet).toMatch(
    /\.shell-mobile-trigger,\s+\.shell-mobile-layer\s+\{\s+display: none;/,
  );
  expect(stylesheet).toMatch(
    /@media \(max-width: 767px\)[\s\S]*?\.shell-mobile-trigger \{\s+display: inline-grid;/,
  );
});
