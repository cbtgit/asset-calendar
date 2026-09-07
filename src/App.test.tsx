import { render, screen } from "@testing-library/react";
import { expect, it } from "vite-plus/test";
import App from "./App";

it("renders the Asset Calendar shell", () => {
  render(<App />);

  expect(screen.getByRole("heading", { name: "Keep every important date in view." })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Add your first asset" })).toBeTruthy();
});
