// @vitest-environment node
import { createRequire } from "node:module";
import { expect, it } from "vite-plus/test";

type AuthConfiguration = {
  environment: string;
  rootDomain: string;
  tenantHosts: string[];
  trustedProxyIps: string[];
  hostPortPolicy: "allow" | "forbid";
  pocketbaseUrl: string;
  invitationUrl: string;
  invitationLifetimeHours: number;
  sessionLifetimeHours: number;
  mailTransport: string;
  smtp2go?: {
    host: string;
    port: number;
    username: string;
    password: string;
    from: string;
  };
};

type AuthConfigurationModule = {
  configurePocketBaseMail: (
    app: { settings: () => { smtp: Record<string, unknown>; meta: Record<string, unknown> } },
    configuration: AuthConfiguration,
  ) => void;
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
    trustedProxyIps: [],
    hostPortPolicy: "allow",
    invitationLifetimeHours: 720,
    sessionLifetimeHours: 24,
    mailTransport: "capture",
  });
});

it("validates production SMTP2GO configuration", () => {
  const config = authConfiguration.validateAuthConfig({
    ...localEnvironment,
    ASSET_CALENDAR_ENV: "production",
    ASSET_CALENDAR_ROOT_DOMAIN: "example.com",
    ASSET_CALENDAR_TENANT_HOSTS: "tenant.example.com, second.example.com",
    ASSET_CALENDAR_POCKETBASE_URL: "https://example.com",
    ASSET_CALENDAR_INVITATION_URL: "https://example.com/setup",
    ASSET_CALENDAR_MAIL_TRANSPORT: "smtp2go",
    ASSET_CALENDAR_SMTP2GO_HOST: "mail.smtp2go.com",
    ASSET_CALENDAR_SMTP2GO_PORT: "2525",
    ASSET_CALENDAR_SMTP2GO_USERNAME: "smtp-user",
    ASSET_CALENDAR_SMTP2GO_PASSWORD: "do-not-print-this",
    ASSET_CALENDAR_SMTP2GO_FROM: "calendar@example.com",
  });

  expect(config.smtp2go).toEqual({
    host: "mail.smtp2go.com",
    port: 2525,
    username: "smtp-user",
    password: "do-not-print-this",
    from: "calendar@example.com",
  });
});

it("applies SMTP2GO settings without persisting credentials", () => {
  const settings = { smtp: {}, meta: {} };
  const config = authConfiguration.validateAuthConfig({
    ...localEnvironment,
    ASSET_CALENDAR_ENV: "production",
    ASSET_CALENDAR_ROOT_DOMAIN: "example.com",
    ASSET_CALENDAR_TENANT_HOSTS: "tenant.example.com",
    ASSET_CALENDAR_POCKETBASE_URL: "https://example.com",
    ASSET_CALENDAR_INVITATION_URL: "https://example.com/setup",
    ASSET_CALENDAR_MAIL_TRANSPORT: "smtp2go",
    ASSET_CALENDAR_SMTP2GO_HOST: "mail.smtp2go.com",
    ASSET_CALENDAR_SMTP2GO_PORT: "2525",
    ASSET_CALENDAR_SMTP2GO_USERNAME: "smtp-user",
    ASSET_CALENDAR_SMTP2GO_PASSWORD: "smtp-password",
    ASSET_CALENDAR_SMTP2GO_FROM: "calendar@example.com",
  });

  authConfiguration.configurePocketBaseMail({ settings: () => settings }, config);

  expect(settings.smtp).toMatchObject({
    enabled: true,
    host: "mail.smtp2go.com",
    port: 2525,
    username: "smtp-user",
    authMethod: "PLAIN",
    tls: false,
  });
  expect(settings.meta).toEqual({ senderAddress: "calendar@example.com" });
});

it("validates tenant host scope and trusted proxy addresses", () => {
  expect(
    authConfiguration.validateAuthConfig({
      ...localEnvironment,
      ASSET_CALENDAR_TRUSTED_PROXY_IPS: "127.0.0.1",
    }),
  ).toMatchObject({ trustedProxyIps: ["127.0.0.1"] });

  expect(() =>
    authConfiguration.validateAuthConfig({
      ...localEnvironment,
      ASSET_CALENDAR_TENANT_HOSTS: "nested.tenant.localhost",
    }),
  ).toThrow("exactly one subdomain");
});

it("reads only the declared configuration keys", () => {
  const values = authConfiguration.readEnvironment((key) =>
    key === "ASSET_CALENDAR_ENV" ? "test" : undefined,
  );

  expect(values).toMatchObject({ ASSET_CALENDAR_ENV: "test" });
  expect(Object.keys(values)).toHaveLength(14);
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
      ASSET_CALENDAR_MAIL_TRANSPORT: "smtp2go",
      ASSET_CALENDAR_SMTP2GO_PASSWORD: secret,
    });
  } catch (caught) {
    error = caught as Error;
  }
  expect(error?.message).not.toContain(secret);
});

it("rejects invalid production SMTP2GO endpoints and senders", () => {
  const productionEnvironment = {
    ...localEnvironment,
    ASSET_CALENDAR_ENV: "production",
    ASSET_CALENDAR_ROOT_DOMAIN: "example.com",
    ASSET_CALENDAR_TENANT_HOSTS: "tenant.example.com",
    ASSET_CALENDAR_POCKETBASE_URL: "https://example.com",
    ASSET_CALENDAR_INVITATION_URL: "https://example.com/setup",
    ASSET_CALENDAR_MAIL_TRANSPORT: "smtp2go",
    ASSET_CALENDAR_SMTP2GO_HOST: "mail.smtp2go.com",
    ASSET_CALENDAR_SMTP2GO_PORT: "2525",
    ASSET_CALENDAR_SMTP2GO_USERNAME: "smtp-user",
    ASSET_CALENDAR_SMTP2GO_PASSWORD: "smtp-password",
    ASSET_CALENDAR_SMTP2GO_FROM: "calendar@example.com",
  };

  expect(() =>
    authConfiguration.validateAuthConfig({
      ...productionEnvironment,
      ASSET_CALENDAR_SMTP2GO_HOST: "https://mail.smtp2go.com",
    }),
  ).toThrow("ASSET_CALENDAR_SMTP2GO_HOST");
  expect(() =>
    authConfiguration.validateAuthConfig({
      ...productionEnvironment,
      ASSET_CALENDAR_SMTP2GO_FROM: "not-an-email",
    }),
  ).toThrow("ASSET_CALENDAR_SMTP2GO_FROM");
});
