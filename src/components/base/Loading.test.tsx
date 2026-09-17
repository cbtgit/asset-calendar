import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { Loading } from "./Loading";

afterEach(cleanup);

describe("Loading", () => {
  it("renders generic loading status text and a decorative spinner", () => {
    render(<Loading />);

    const status = screen.getByRole("status");
    const spinner = status.querySelector(".loading-spinner");

    expect(status.textContent).toBe("Loading...");
    expect(spinner?.getAttribute("aria-hidden")).toBe("true");
  });

  it("supports a layout modifier class", () => {
    render(<Loading className="loading-page" />);

    const status = screen.getByRole("status");

    expect(status.className).toContain("loading loading-page");
  });
});
