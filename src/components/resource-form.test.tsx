import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { ApplicationError } from "@/api/errors";
import { ResourceForm } from "./resource-form";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  create: { isPending: false, mutate: vi.fn() },
  update: { isPending: false, mutate: vi.fn() },
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("@/hooks/use-resources", () => ({
  useCreateResourceMutation: () => mocks.create,
  useUpdateResourceMutation: () => mocks.update,
}));

const resource = {
  id: "resource-1",
  name: "Room",
  base_rate_minor_units: 1250,
  archived: false,
  created: "now",
  updated: "now",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("validates locale-formatted input and submits create and edit mutations", () => {
  render(<ResourceForm locale="de-DE" currency="EUR" />);
  fireEvent.change(screen.getByLabelText("Resource name"), { target: { value: "Meeting room" } });
  fireEvent.change(screen.getByLabelText(/Base rate/), { target: { value: "12,50" } });
  fireEvent.click(screen.getByRole("button", { name: "Create resource" }));
  expect(mocks.create.mutate).toHaveBeenCalledWith(
    { name: "Meeting room", base_rate_minor_units: 1250 },
    expect.any(Object),
  );

  fireEvent.change(screen.getByLabelText(/Base rate/), { target: { value: "invalid" } });
  fireEvent.click(screen.getByRole("button", { name: "Create resource" }));
  expect(screen.getByRole("alert").textContent).toContain("selected locale");
  cleanup();
  render(<ResourceForm resource={resource} locale="en-US" currency="USD" />);
  fireEvent.change(screen.getByLabelText("Resource name"), { target: { value: "Updated room" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(mocks.update.mutate).toHaveBeenCalledWith(
    { id: "resource-1", input: { name: "Updated room", base_rate_minor_units: 1250 } },
    expect.any(Object),
  );
});

it("preserves dirty rate locale when the form locale changes", () => {
  const { rerender } = render(<ResourceForm locale="de-DE" currency="EUR" />);
  fireEvent.change(screen.getByLabelText("Resource name"), { target: { value: "Meeting room" } });
  fireEvent.change(screen.getByLabelText(/Base rate/), { target: { value: "12,50" } });
  rerender(<ResourceForm locale="en-US" currency="USD" />);
  fireEvent.click(screen.getByRole("button", { name: "Create resource" }));

  expect(mocks.create.mutate).toHaveBeenCalledWith(
    { name: "Meeting room", base_rate_minor_units: 1250 },
    expect.any(Object),
  );
});

it("surfaces server rejection and navigates after success", () => {
  render(<ResourceForm locale="en-US" currency="USD" />);
  fireEvent.change(screen.getByLabelText("Resource name"), { target: { value: "Room" } });
  fireEvent.change(screen.getByLabelText(/Base rate/), { target: { value: "10.00" } });
  fireEvent.click(screen.getByRole("button", { name: "Create resource" }));
  const options = mocks.create.mutate.mock.calls[0][1];
  void act(() => options.onError(new Error("server rejected")));
  expect(screen.getByRole("alert").textContent).toContain("server rejected");
  void act(() => options.onSuccess());
  expect(mocks.navigate).toHaveBeenCalledWith({ to: "/resources" });
});

it("maps duplicate resource errors to an actionable message", () => {
  render(<ResourceForm locale="en-US" currency="USD" />);
  fireEvent.change(screen.getByLabelText("Resource name"), { target: { value: "Room" } });
  fireEvent.change(screen.getByLabelText(/Base rate/), { target: { value: "10.00" } });
  fireEvent.click(screen.getByRole("button", { name: "Create resource" }));
  const options = mocks.create.mutate.mock.calls[0][1];

  void act(() => options.onError(new ApplicationError("conflict", "validation_not_unique")));

  expect(screen.getByRole("alert").textContent).toBe("A resource with this name already exists.");
  expect(screen.getByLabelText("Resource name").getAttribute("aria-invalid")).toBe("true");
  expect(screen.getByLabelText("Resource name").getAttribute("aria-describedby")).toBe(
    "resource-form-error",
  );
  expect(screen.getByLabelText(/Base rate/).getAttribute("aria-invalid")).toBe("true");
});
