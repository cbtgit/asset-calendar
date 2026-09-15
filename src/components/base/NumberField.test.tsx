import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { NumberField } from "./NumberField";
import { normalizeLocalizedNumber } from "./NumberField.utils";

afterEach(cleanup);

describe("NumberField", () => {
  it("renders a locale-friendly decimal input", () => {
    render(<NumberField id="price" label="Hourly price" value="12,50" readOnly />);

    const input = screen.getByLabelText("Hourly price");
    expect(input.getAttribute("type")).toBe("text");
    expect(input.getAttribute("inputmode")).toBe("decimal");
  });

  it("normalizes comma and grouped decimal values", () => {
    expect(normalizeLocalizedNumber("12,50")).toBe("12.50");
    expect(normalizeLocalizedNumber("1.234,50")).toBe("1234.50");
    expect(normalizeLocalizedNumber("1,234.50")).toBe("1234.50");
    expect(normalizeLocalizedNumber("12,5x")).toBeUndefined();
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
