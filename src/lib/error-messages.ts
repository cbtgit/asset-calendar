import { ApplicationError } from "@/api/errors";

export type MutationErrorContext =
  | "booking-type-save"
  | "booking-type-create"
  | "booking-type-archive"
  | "resource-save"
  | "resource-archive";

function values(error: unknown, depth = 0): string[] {
  if (depth > 4 || error === null || error === undefined) return [];
  if (typeof error === "string") return [error.toLowerCase()];
  if (typeof error !== "object") return [];

  const result: string[] = [];
  const record = error as Record<string, unknown>;
  for (const key of ["message", "code"]) {
    if (typeof record[key] === "string") result.push(record[key].toLowerCase());
  }
  for (const key of ["cause", "data", "response"]) {
    result.push(...values(record[key], depth + 1));
  }
  if (typeof record.response === "object" && record.response !== null) {
    result.push(...values((record.response as Record<string, unknown>).data, depth + 1));
  }
  if (typeof record.data === "object" && record.data !== null) {
    for (const value of Object.values(record.data)) result.push(...values(value, depth + 1));
  }
  return result;
}

function hasCode(error: unknown, code: string): boolean {
  return values(error).some((value) => value === code || value.includes(code));
}

function kind(error: unknown): ApplicationError["kind"] | undefined {
  if (error instanceof ApplicationError) return error.kind;
  if (typeof error !== "object" || error === null) return undefined;
  const value = Reflect.get(error, "kind");
  return value === "validation" ||
    value === "unauthorized" ||
    value === "not-found" ||
    value === "conflict" ||
    value === "network" ||
    value === "server"
    ? value
    : undefined;
}

function fallback(error: unknown, message: string): string {
  return error instanceof Error && error.message ? error.message : message;
}

export function mutationErrorMessage(error: unknown, context: MutationErrorContext): string {
  const errorKind = kind(error);
  const unique =
    hasCode(error, "validation_not_unique") ||
    (errorKind === "conflict" &&
      (context === "booking-type-save" ||
        context === "booking-type-create" ||
        context === "resource-save"));

  if (context.startsWith("booking-type")) {
    if (unique) return "A booking type with this name already exists.";
    if (hasCode(error, "booking_type_name_required")) return "Enter a booking type name.";
    if (hasCode(error, "booking_type_name_too_long")) {
      return "Booking type names must be 200 characters or fewer.";
    }
    if (hasCode(error, "booking_type_surcharge_invalid")) {
      return "Enter a non-negative amount with up to two decimal places.";
    }
    if (
      hasCode(error, "booking_type_regular_surcharge_protected") ||
      hasCode(error, "booking_type_maintenance_surcharge_protected")
    ) {
      return "Regular and Maintenance booking types cannot have a surcharge.";
    }
    if (
      hasCode(error, "booking_type_archival_protected") ||
      hasCode(error, "booking_type_archival_irreversible") ||
      hasCode(error, "booking_type_archival_configuration_protected")
    ) {
      return "This booking type cannot be archived with configuration changes.";
    }
    if (errorKind === "unauthorized" || hasCode(error, "authorization_failed")) {
      return "You are not authorized to change booking types.";
    }
    if (errorKind === "not-found" || hasCode(error, "booking_type_not_found")) {
      return "This booking type is no longer available.";
    }
    if (errorKind === "validation") return "Check the booking type details and try again.";
    return fallback(error, "We could not save this booking type. Try again.");
  }

  if (unique) return "A resource with this name already exists.";
  if (hasCode(error, "resource_name_required")) return "Enter a resource name.";
  if (hasCode(error, "resource_name_too_long")) {
    return "Resource names must be 200 characters or fewer.";
  }
  if (hasCode(error, "resource_base_rate_invalid")) {
    return "Enter a non-negative whole-number resource rate.";
  }
  if (
    hasCode(error, "resource_archival_irreversible") ||
    hasCode(error, "resource_archival_configuration_protected")
  ) {
    return "This resource cannot be archived with configuration changes.";
  }
  if (errorKind === "unauthorized" || hasCode(error, "authorization_failed")) {
    return "You are not authorized to change resources.";
  }
  if (errorKind === "not-found" || hasCode(error, "resource_not_found")) {
    return "This resource is no longer available.";
  }
  if (errorKind === "validation") return "Check the resource name and rate, then try again.";
  return fallback(error, "We could not save this resource. Try again.");
}
