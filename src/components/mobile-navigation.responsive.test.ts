/// <reference types="node" />

import { readFileSync } from "node:fs";
import { expect, it } from "vite-plus/test";

it("keeps the mobile navigation CSS contract below the 768px breakpoint", () => {
  const stylesheet = readFileSync("src/App.css", "utf8");
  const resourceStyles = readFileSync("src/components/resource-admin.css", "utf8");
  const bookingTypeStyles = readFileSync("src/components/booking-types-directory.css", "utf8");

  expect(stylesheet).toContain("@media (max-width: 767px)");
  expect(stylesheet).toMatch(
    /\.shell-mobile-trigger,\s+\.shell-mobile-layer\s+\{\s+display: none;/,
  );
  expect(stylesheet).toMatch(
    /@media \(max-width: 767px\)[\s\S]*?\.shell-mobile-trigger \{\s+display: inline-grid;/,
  );
  expect(resourceStyles).toMatch(
    /@media \(max-width: 767px\)[\s\S]*?\.resource-row \{\s+grid-template-columns: 1fr;/,
  );
  expect(resourceStyles).toContain(".resource-dialog {");
  expect(resourceStyles).toContain("width: min(100%, 30rem);");
  expect(bookingTypeStyles).toMatch(
    /@media \(max-width: 767px\)[\s\S]*?\.booking-types-row \{\s+grid-template-columns: 1fr;/,
  );
  expect(bookingTypeStyles).toContain(".booking-types-dialog {");
  expect(bookingTypeStyles).toContain("width: min(100%, 28rem);");
});
