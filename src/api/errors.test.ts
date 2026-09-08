import { expect, it } from "vite-plus/test";
import { AppError, toAppError } from "./errors";

it("classifies PocketBase failures and keeps the original cause", () => {
  const cause = Object.assign(new Error("Conflict"), { status: 409 });
  const error = toAppError(cause);

  expect(error).toBeInstanceOf(AppError);
  expect(error.kind).toBe("conflict");
  expect(error.cause).toBe(cause);
  expect(error.message).toBe("Conflict");
});
