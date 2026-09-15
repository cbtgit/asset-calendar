import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vite-plus/test";
import { Button } from "./Button";

describe("Button", () => {
  it("defaults to a secondary button action", () => {
    render(<Button>Save</Button>);

    const button = screen.getByRole("button", { name: "Save" });
    expect(button.getAttribute("type")).toBe("button");
    expect(button.className).toContain("button button-default button-secondary");
  });

  it("supports variants, compact sizing, and custom classes", () => {
    render(
      <Button className="groups-directory-action" size="compact" variant="danger">
        Delete
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Delete" });
    expect(button.className).toContain("button-compact");
    expect(button.className).toContain("button-danger");
    expect(button.className).toContain("groups-directory-action");
  });

  it("preserves disabled behavior and accepts refs as props", () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <Button ref={ref} disabled>
        Submit
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Submit" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(ref.current).toBe(button);
  });
});
