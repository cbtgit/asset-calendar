import { expect, it } from "vite-plus/test";
import { APPLICATION_TIME_ZONE, formatApplicationDate } from "./time";

it("formats dates in the shared application timezone", () => {
  expect(APPLICATION_TIME_ZONE).toBe("Europe/Copenhagen");
  expect(formatApplicationDate(new Date("2026-09-16T22:30:00.000Z"))).toBe("2026-09-17");
  expect(formatApplicationDate(new Date("2026-01-01T23:30:00.000Z"))).toBe("2026-01-02");
});
