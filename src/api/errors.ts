export type AppErrorKind =
  | "validation"
  | "unauthorized"
  | "not-found"
  | "conflict"
  | "network"
  | "server";

export class ApplicationError extends Error {
  readonly kind: AppErrorKind;

  constructor(kind: AppErrorKind, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "AppError";
    this.kind = kind;
  }
}

export { ApplicationError as AppError };

function responseStatus(cause: unknown): number | undefined {
  if (typeof cause !== "object" || cause === null) return undefined;

  const status = Reflect.get(cause, "status");
  if (typeof status === "number") return status;

  const response = Reflect.get(cause, "response");
  if (typeof response === "object" && response !== null) {
    const responseStatus = Reflect.get(response, "status");
    if (typeof responseStatus === "number") return responseStatus;
  }

  return undefined;
}

export function toAppError(cause: unknown): ApplicationError {
  if (cause instanceof ApplicationError) return cause;

  const status = responseStatus(cause);
  const kind: AppErrorKind =
    status === 400 || status === 422
      ? "validation"
      : status === 401 || status === 403
        ? "unauthorized"
        : status === 404
          ? "not-found"
          : status === 409
            ? "conflict"
            : status !== undefined && status >= 500
              ? "server"
              : cause instanceof TypeError || status === 0
                ? "network"
                : "server";

  const message =
    cause instanceof Error && cause.message
      ? cause.message
      : "PocketBase could not complete the request.";

  return new ApplicationError(kind, message, cause);
}
