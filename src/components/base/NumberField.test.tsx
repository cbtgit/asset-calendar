import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { NumberField } from "./NumberField";
import { normalizeLocalizedNumber, toMinorUnits } from "./NumberField.utils";

afterEach(cleanup);

describe("NumberField", () => {
  it("renders a locale-friendly decimal input", () => {
    render(<NumberField id="price" label="Hourly price" value="12,50" readOnly />);

    const input = screen.getByLabelText("Hourly price");
    expect(input.getAttribute("type")).toBe("text");
    expect(input.getAttribute("inputmode")).toBe("decimal");
  });

  it("normalizes values using the locale separators", () => {
    expect(normalizeLocalizedNumber("12,50")).toBe("12.50");
    expect(normalizeLocalizedNumber("1.234,50")).toBe("1234.50");
    expect(normalizeLocalizedNumber("1,234.50", "en-US")).toBe("1234.50");
    expect(normalizeLocalizedNumber("12.50", "en-US")).toBe("12.50");
  });

  it("rejects malformed or incorrectly grouped values", () => {
    expect(normalizeLocalizedNumber("1,234.50")).toBeUndefined();
    expect(normalizeLocalizedNumber("12.50")).toBeUndefined();
    expect(normalizeLocalizedNumber("1.23,45")).toBeUndefined();
    expect(normalizeLocalizedNumber("1.234,5x")).toBeUndefined();
    expect(normalizeLocalizedNumber("1,23", "en-US")).toBeUndefined();
    expect(normalizeLocalizedNumber("12,345", "en-US")).toBe("12345");
    expect(normalizeLocalizedNumber("12,345", "en_US")).toBeUndefined();
  });

  it("converts localized currency values to integer minor units", () => {
    expect(toMinorUnits("12,50")).toBe(1250);
    expect(toMinorUnits("125")).toBe(12500);
    expect(toMinorUnits("1,234.50", "en-US")).toBe(123450);
    expect(toMinorUnits("0")).toBe(0);
    expect(toMinorUnits("12,5x")).toBeUndefined();
    expect(toMinorUnits("90071992547409,91")).toBe(Number.MAX_SAFE_INTEGER);
    expect(toMinorUnits("90071992547409,92")).toBeUndefined();
  });

  it("associates errors with the input", () => {
    render(
      <NumberField
        id="price"
        label="Hourly price"
        value="12,5x"
        error="Enter a valid hourly price."
        readOnly
      />,
    );

    const input = screen.getByLabelText("Hourly price");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("price-error");
    expect(screen.getByRole("alert").textContent).toContain("valid hourly price");
  });
});
