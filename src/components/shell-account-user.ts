import { getAuthSnapshot } from "@/api/auth";

export function getShellUserName(): string {
  const { user } = getAuthSnapshot();
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
  return name || user?.email || "Current user";
}

export function getShellUserInitials(name: string): string {
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return initials || "?";
}
