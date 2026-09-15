import { expect, it } from "vite-plus/test";
import { AppError, hasValidationCode, toAppError } from "./errors";

it("classifies PocketBase failures and keeps the original cause", () => {
  const cause = Object.assign(new Error("Conflict"), { status: 409 });
  const error = toAppError(cause);

  expect(error).toBeInstanceOf(AppError);
  expect(error.kind).toBe("conflict");
  expect(error.cause).toBe(cause);
  expect(error.message).toBe("Conflict");
});

it("finds validation codes in the response when direct data is empty", () => {
  const cause = Object.assign(new Error("Failed to create record."), {
    status: 400,
    data: {},
    response: {
      data: {
        name_normalized: { code: "validation_not_unique" },
      },
    },
  });
  const error = toAppError(cause);

  expect(hasValidationCode(error, "validation_not_unique")).toBe(true);
});
