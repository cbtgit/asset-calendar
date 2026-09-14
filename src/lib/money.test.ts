import { expect, it } from "vite-plus/test";
import { formatMoney, parseMoney } from "./money";

it("parses only unambiguous locale-specific money", () => {
  expect(parseMoney("1.234,50", "da-DK")).toEqual({ value: 123450 });
  expect(parseMoney("1,234.50", "en-US")).toEqual({ value: 123450 });
  expect(parseMoney("1,234.50", "da-DK")).toHaveProperty("error");
  expect(parseMoney("1.234,50", "en-US")).toHaveProperty("error");
  expect(parseMoney("12,34,567.00", "en-US")).toHaveProperty("error");
});

it("formats minor units with the tenant locale and currency", () => {
  expect(formatMoney(123450, "da-DK", "DKK")).toContain("1.234,50");
  expect(formatMoney(123450, "en-US", "USD")).toContain("$1,234.50");
});
