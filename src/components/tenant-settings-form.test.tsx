import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { cleanup } from "@testing-library/react";
import { TenantSettingsForm } from "./tenant-settings-form";

const mocks = vi.hoisted(() => ({
  settings: {
    data: { currency: "EUR", locale: "da-DK" },
    isPending: false,
    isError: false,
  },
  update: { isPending: false, mutate: vi.fn() },
}));

vi.mock("@/hooks/use-tenant-settings", () => ({
  useTenantSettingsQuery: () => mocks.settings,
  useUpdateTenantSettingsMutation: () => mocks.update,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("normalizes locale input and presents immutable currency", async () => {
  render(<TenantSettingsForm />);
  const locale = screen.getByLabelText("Locale");
  expect(screen.getByLabelText("Currency").getAttribute("readonly")).toBe("");
  expect((screen.getByLabelText("Currency") as HTMLInputElement).value).toBe("EUR");
  fireEvent.change(locale, { target: { value: " en-gb " } });
  fireEvent.submit(screen.getByRole("button", { name: "Save settings" }));
  await waitFor(() =>
    expect(mocks.update.mutate).toHaveBeenCalledWith(
      { locale: "en-GB" },
      expect.objectContaining({ onError: expect.any(Function) }),
    ),
  );
});

it("reconciles canonical locale after a successful save and refetch", async () => {
  const { rerender } = render(<TenantSettingsForm />);
  const locale = screen.getByLabelText("Locale");
  fireEvent.change(locale, { target: { value: " en-gb " } });
  fireEvent.submit(screen.getByRole("button", { name: "Save settings" }));
  await waitFor(() => expect(mocks.update.mutate).toHaveBeenCalled());

  const options = mocks.update.mutate.mock.calls[0][1];
  options.onSuccess({ id: "tenant-1", currency: "EUR", locale: "en-GB" });
  mocks.settings.data = { currency: "EUR", locale: "en-GB" };
  rerender(<TenantSettingsForm />);

  expect((screen.getByLabelText("Locale") as HTMLInputElement).value).toBe("en-GB");
});

it("shows validation and server errors without changing currency", async () => {
  render(<TenantSettingsForm />);
  fireEvent.change(screen.getByLabelText("Locale"), { target: { value: "not a locale" } });
  fireEvent.submit(screen.getByRole("button", { name: "Save settings" }));
  expect(screen.getByRole("alert").textContent).toContain("valid BCP 47 locale");
  expect(mocks.update.mutate).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText("Locale"), { target: { value: "en-US" } });
  fireEvent.submit(screen.getByRole("button", { name: "Save settings" }));
  const options = mocks.update.mutate.mock.calls[0][1];
  options.onError(new Error("server rejected locale"));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("server rejected locale"),
  );
  expect((screen.getByLabelText("Currency") as HTMLInputElement).value).toBe("EUR");
});

it("does not overwrite dirty input or refocus after a settings refetch", () => {
  const { rerender } = render(<TenantSettingsForm />);
  const locale = screen.getByLabelText("Locale") as HTMLInputElement;
  fireEvent.change(locale, { target: { value: "fr-FR" } });
  const other = screen.getByLabelText("Currency");
  other.focus();
  mocks.settings.data = { currency: "EUR", locale: "en-US" };
  rerender(<TenantSettingsForm />);
  expect(locale.value).toBe("fr-FR");
  expect(document.activeElement).toBe(other);
});
