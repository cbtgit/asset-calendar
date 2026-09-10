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

const statusKinds: Partial<Record<number, AppErrorKind>> = {
  400: "validation",
  401: "unauthorized",
  403: "unauthorized",
  404: "not-found",
  409: "conflict",
  422: "validation",
};

function errorKind(cause: unknown, status: number | undefined): AppErrorKind {
  const statusKind = status === undefined ? undefined : statusKinds[status];
  if (statusKind) return statusKind;
  if (status !== undefined && status >= 500) return "server";
  if (cause instanceof TypeError || status === 0) return "network";
  return "server";
}

export function toAppError(cause: unknown): ApplicationError {
  if (cause instanceof ApplicationError) return cause;

  const status = responseStatus(cause);
  const kind = errorKind(cause, status);

  const message =
    cause instanceof Error && cause.message
      ? cause.message
      : "PocketBase could not complete the request.";

  return new ApplicationError(kind, message, cause);
}
