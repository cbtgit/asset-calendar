// @vitest-environment node
import { createRequire } from "node:module";
import { expect, it } from "vite-plus/test";

type AuthConfiguration = {
  environment: string;
  rootDomain: string;
  tenantHosts: string[];
  pocketbaseUrl: string;
  invitationUrl: string;
  invitationLifetimeHours: number;
  sessionLifetimeHours: number;
  mailTransport: string;
  brevo?: {
    host: string;
    port: number;
    username: string;
    password: string;
    from: string;
  };
};

type AuthConfigurationModule = {
  readEnvironment: (
    getenv: (key: string) => string | undefined,
  ) => Record<string, string | undefined>;
  validateAuthConfig: (environment: Record<string, string | undefined>) => AuthConfiguration;
};

const authConfiguration = createRequire(import.meta.url)(
  "../pb_hooks/auth-config.cjs",
) as AuthConfigurationModule;

const localEnvironment = {
  ASSET_CALENDAR_ENV: "local",
  ASSET_CALENDAR_ROOT_DOMAIN: "localhost",
  ASSET_CALENDAR_TENANT_HOSTS: "tenant.localhost",
  ASSET_CALENDAR_POCKETBASE_URL: "http://127.0.0.1:8090",
  ASSET_CALENDAR_INVITATION_URL: "http://localhost:5173/setup",
  ASSET_CALENDAR_INVITATION_LIFETIME_HOURS: "720",
  ASSET_CALENDAR_SESSION_LIFETIME_HOURS: "24",
  ASSET_CALENDAR_MAIL_TRANSPORT: "capture",
};

it("validates local capture configuration and fixed lifetimes", () => {
  expect(authConfiguration.validateAuthConfig(localEnvironment)).toMatchObject({
    environment: "local",
    rootDomain: "localhost",
    tenantHosts: ["tenant.localhost"],
    invitationLifetimeHours: 720,
    sessionLifetimeHours: 24,
    mailTransport: "capture",
  });
});

it("validates production Brevo configuration", () => {
  const config = authConfiguration.validateAuthConfig({
    ...localEnvironment,
    ASSET_CALENDAR_ENV: "production",
    ASSET_CALENDAR_ROOT_DOMAIN: "example.com",
    ASSET_CALENDAR_TENANT_HOSTS: "tenant.example.com, second.example.com",
    ASSET_CALENDAR_POCKETBASE_URL: "https://example.com",
    ASSET_CALENDAR_INVITATION_URL: "https://example.com/setup",
    ASSET_CALENDAR_MAIL_TRANSPORT: "brevo",
    ASSET_CALENDAR_BREVO_HOST: "smtp-relay.brevo.com",
    ASSET_CALENDAR_BREVO_PORT: "587",
    ASSET_CALENDAR_BREVO_USERNAME: "smtp-user",
    ASSET_CALENDAR_BREVO_PASSWORD: "do-not-print-this",
    ASSET_CALENDAR_BREVO_FROM: "calendar@example.com",
  });

  expect(config.brevo).toEqual({
    host: "smtp-relay.brevo.com",
    port: 587,
    username: "smtp-user",
    password: "do-not-print-this",
    from: "calendar@example.com",
  });
});

it("reads only the declared configuration keys", () => {
  const values = authConfiguration.readEnvironment((key) =>
    key === "ASSET_CALENDAR_ENV" ? "test" : undefined,
  );

  expect(values).toMatchObject({ ASSET_CALENDAR_ENV: "test" });
  expect(Object.keys(values)).toHaveLength(13);
});

it("rejects invalid values without exposing SMTP secrets", () => {
  expect(() =>
    authConfiguration.validateAuthConfig({
      ...localEnvironment,
      ASSET_CALENDAR_TENANT_HOSTS: "tenant.localhost, tenant.localhost",
    }),
  ).toThrow("duplicate hosts");

  expect(() =>
    authConfiguration.validateAuthConfig({
      ...localEnvironment,
      ASSET_CALENDAR_INVITATION_LIFETIME_HOURS: "24",
    }),
  ).toThrow("must be 720");

  const secret = "smtp-secret-that-must-not-appear";
  let error: Error | undefined;
  try {
    authConfiguration.validateAuthConfig({
      ...localEnvironment,
      ASSET_CALENDAR_ENV: "production",
      ASSET_CALENDAR_MAIL_TRANSPORT: "brevo",
      ASSET_CALENDAR_BREVO_PASSWORD: secret,
    });
  } catch (caught) {
    error = caught as Error;
  }
  expect(error?.message).not.toContain(secret);
});
