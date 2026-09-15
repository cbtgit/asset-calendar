import { describe, expect, it } from "vite-plus/test";
import { formatMinorUnitsForDisplay, formatMinorUnitsForInput } from "./money";

describe("money formatting", () => {
  it("formats editable values with Danish separators", () => {
    expect(formatMinorUnitsForInput(1250)).toBe("12,50");
    expect(formatMinorUnitsForInput(0)).toBe("0,00");
    expect(formatMinorUnitsForInput(Number.MAX_SAFE_INTEGER)).toBe("90.071.992.547.409,91");
  });

  it("formats read-only values with the default currency", () => {
    expect(formatMinorUnitsForDisplay(1250)).toContain("12,50");
    expect(formatMinorUnitsForDisplay(1250)).toContain("kr.");
  });

  it("accepts a future injected locale and currency context", () => {
    expect(formatMinorUnitsForInput(1250, "en-US")).toBe("12.50");
    expect(formatMinorUnitsForDisplay(1250, { locale: "en-US", currency: "USD" })).toBe("$12.50");
  });
});
