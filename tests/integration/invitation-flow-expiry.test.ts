// @vitest-environment node
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { afterEach, beforeEach, expect, it } from "vite-plus/test";

const originalEnvironment = {
  ASSET_CALENDAR_ENV: process.env.ASSET_CALENDAR_ENV,
  ASSET_CALENDAR_ROOT_DOMAIN: process.env.ASSET_CALENDAR_ROOT_DOMAIN,
  ASSET_CALENDAR_TENANT_HOSTS: process.env.ASSET_CALENDAR_TENANT_HOSTS,
  ASSET_CALENDAR_POCKETBASE_URL: process.env.ASSET_CALENDAR_POCKETBASE_URL,
  ASSET_CALENDAR_INVITATION_URL: process.env.ASSET_CALENDAR_INVITATION_URL,
  ASSET_CALENDAR_INVITATION_LIFETIME_HOURS: process.env.ASSET_CALENDAR_INVITATION_LIFETIME_HOURS,
  ASSET_CALENDAR_SESSION_LIFETIME_HOURS: process.env.ASSET_CALENDAR_SESSION_LIFETIME_HOURS,
  ASSET_CALENDAR_MAIL_TRANSPORT: process.env.ASSET_CALENDAR_MAIL_TRANSPORT,
};
let invitationFlow: {
  isInvitationValid: (
    invitation: { get: (field: string) => unknown },
    tenantId: string,
    now: Date,
  ) => boolean;
};

beforeEach(() => {
  Object.assign(process.env, {
    ASSET_CALENDAR_ENV: "test",
    ASSET_CALENDAR_ROOT_DOMAIN: "localhost",
    ASSET_CALENDAR_TENANT_HOSTS: "tenant.localhost",
    ASSET_CALENDAR_POCKETBASE_URL: "http://127.0.0.1:8090",
    ASSET_CALENDAR_INVITATION_URL: "http://localhost:5173/setup",
    ASSET_CALENDAR_INVITATION_LIFETIME_HOURS: "720",
    ASSET_CALENDAR_SESSION_LIFETIME_HOURS: "24",
    ASSET_CALENDAR_MAIL_TRANSPORT: "test",
  });
  (globalThis as { __hooks?: string }).__hooks = resolve(
    import.meta.dirname,
    "../../pb_hooks",
  );
  (globalThis as { $os?: { getenv: (key: string) => string | undefined } })[
    "$os"
  ] = {
    getenv: (key) => process.env[key],
  };
  invitationFlow = createRequire(import.meta.url)(
    "../../pb_hooks/invitation-flow.cjs",
  );
});
afterEach(() => {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key as keyof NodeJS.ProcessEnv];
    else process.env[key as keyof NodeJS.ProcessEnv] = value;
  }
  delete (globalThis as { __hooks?: string }).__hooks;
  delete (globalThis as { $os?: unknown }).$os;
});

it("uses an exact 30-day, one-time expiry window", () => {
  const issuedAt = new Date("2026-01-01T00:00:00.000Z");
  const expiresAt = new Date(issuedAt.getTime() + 720 * 60 * 60 * 1000);
  const invitation = {
    get: (field: string) =>
      (
        {
          tenant: "tenant-id",
          expires_at: expiresAt.toISOString(),
          used_at: "",
        } as Record<string, unknown>
      )[field],
  };

  expect(
    invitationFlow.isInvitationValid(
      invitation,
      "tenant-id",
      new Date(expiresAt.getTime() - 1),
    ),
  ).toBe(true);
  expect(invitationFlow.isInvitationValid(invitation, "tenant-id", expiresAt)).toBe(
    false,
  );
  expect(
    invitationFlow.isInvitationValid(invitation, "other-tenant", issuedAt),
  ).toBe(false);
});
