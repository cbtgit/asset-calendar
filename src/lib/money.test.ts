import { expect, it } from "vite-plus/test";
import { formatMoney, formatMoneyInput, parseMoney } from "./money";

it("parses only unambiguous locale-specific money", () => {
  expect(parseMoney("1.234,50", "da-DK")).toEqual({ value: 123450 });
  expect(parseMoney("1,234.50", "en-US")).toEqual({ value: 123450 });
  expect(parseMoney("12,34,567.00", "en-IN")).toEqual({ value: 123456700 });
  expect(parseMoney("1,234.50", "da-DK")).toHaveProperty("error");
  expect(parseMoney("1.234,50", "en-US")).toHaveProperty("error");
  expect(parseMoney("12,34,567.00", "en-US")).toHaveProperty("error");
  expect(parseMoney("12.34.567,00", "en-IN")).toHaveProperty("error");
});

it("parses native locale digits", () => {
  const formatted = formatMoneyInput(123450, "ar-EG");
  expect(formatted).toContain("١");
  expect(parseMoney(formatted, "ar-EG")).toEqual({ value: 123450 });
  expect(parseMoney("١٬٢٣٤٫٥٠", "ar-EG")).toEqual({ value: 123450 });
});

it("formats minor units with the tenant locale and currency", () => {
  expect(formatMoney(123450, "da-DK", "DKK")).toContain("1.234,50");
  expect(formatMoney(123450, "en-US", "USD")).toContain("$1,234.50");
});

it("round-trips the largest safe minor-unit value without cent loss", () => {
  const value = Number.MAX_SAFE_INTEGER;
  const formatted = formatMoneyInput(value, "en-US");
  expect(formatted).toBe("90,071,992,547,409.91");
  expect(parseMoney(formatted, "en-US")).toEqual({ value });
  expect(formatMoney(value, "en-US", "USD")).toBe("$90,071,992,547,409.91");
});
