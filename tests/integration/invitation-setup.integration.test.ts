// @vitest-environment node
import { createHash, randomBytes } from "node:crypto";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import PocketBase from "pocketbase";
import { afterAll, beforeAll, expect, it } from "vite-plus/test";
import {
  startPocketBaseIntegrationHarness,
  type PocketBaseIntegrationHarness,
} from "./pocketbase-harness";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const productionMigrations = resolve(root, "pb_migrations");
const adminPassword = "Correct horse battery staple!";
const pendingEmail = "pending-a@example.test";
const setupToken = randomBytes(32).toString("hex");
const setupPassword = randomBytes(16).toString("hex");
const originalTenantHosts = process.env.ASSET_CALENDAR_TENANT_HOSTS;

let harness: PocketBaseIntegrationHarness;
let migrationsDir: string;

async function createSeededMigrations(): Promise<string> {
  migrationsDir = await mkdtemp(resolve(tmpdir(), "asset-calendar-invitation-migrations-"));
  await cp(productionMigrations, migrationsDir, { recursive: true });
  const setupTokenHash = createHash("sha256").update(setupToken).digest("hex");
  await writeFile(
    resolve(migrationsDir, "1710000005_invitation_fixture.js"),
    `migrate((app) => {
  const tenants = app.findCollectionByNameOrId("tenants");
  const units = app.findCollectionByNameOrId("organizational_units");
  const users = app.findCollectionByNameOrId("users");
  const invitations = app.findCollectionByNameOrId("user_invitations");
  const tenant = new Record(tenants);
  tenant.set("name", "Tenant A");
  tenant.set("subdomain", "tenant");
  app.save(tenant);
  const otherTenant = new Record(tenants);
  otherTenant.set("name", "Tenant B");
  otherTenant.set("subdomain", "other");
  app.save(otherTenant);
  const unit = new Record(units);
  unit.set("tenant", tenant.id);
  unit.set("name", "Unit A");
  app.save(unit);
  for (const data of [
    { email: "admin-a@example.test", pending: false },
    { email: ${JSON.stringify(pendingEmail)}, pending: true },
  ]) {
    const user = new Record(users);
    user.set("email", data.email);
    user.set("password", ${JSON.stringify(adminPassword)});
    user.set("passwordConfirm", ${JSON.stringify(adminPassword)});
    user.set("tenant", tenant.id);
    user.set("organizational_unit", unit.id);
    user.set("role", data.pending ? "regular" : "administrator");
    user.set("active", true);
    user.set("password_setup_pending", data.pending);
    app.save(user);
    if (data.pending) {
      const invitation = new Record(invitations);
      invitation.set("user", user.id);
      invitation.set("tenant", tenant.id);
      invitation.set("token_hash", ${JSON.stringify(setupTokenHash)});
      invitation.set("expires_at", "2030-01-01T00:00:00.000Z");
      app.save(invitation);
    }
  }
}, () => {});`,
  );
  return migrationsDir;
}

async function request(
  pocketbase: PocketBase,
  path: string,
  options: { method?: string; body?: unknown; host?: string } = {},
): Promise<Response> {
  const port = new URL(harness.baseUrl).port;
  const origin = options.host ? `http://${options.host}:${port}` : harness.baseUrl;
  return fetch(`${origin}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body === undefined ? {} : { "content-type": "application/json" }),
      ...(pocketbase.authStore.token ? { authorization: pocketbase.authStore.token } : {}),
      ...(options.host === undefined ? {} : { host: options.host }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

beforeAll(async () => {
  process.env.ASSET_CALENDAR_TENANT_HOSTS = "tenant.localhost,other.localhost";
  harness = await startPocketBaseIntegrationHarness({
    migrationsDir: await createSeededMigrations(),
  });
});

afterAll(async () => {
  if (harness) await harness.stop();
  if (migrationsDir) await rm(migrationsDir, { recursive: true, force: true });
  if (originalTenantHosts === undefined) delete process.env.ASSET_CALENDAR_TENANT_HOSTS;
  else process.env.ASSET_CALENDAR_TENANT_HOSTS = originalTenantHosts;
});

it("creates an invitation with a generic result without exposing its message", async () => {
  const admin = new PocketBase(harness.baseUrl);
  const login = await request(admin, "/api/collections/users/auth-with-password", {
    method: "POST",
    host: "tenant.localhost",
    body: { identity: "admin-a@example.test", password: adminPassword },
  });
  expect(login.status).toBe(200);
  const auth = await login.json();
  admin.authStore.save(auth.token, auth.record);

  const usersResponse = await request(admin, "/api/collections/users/records", {
    host: "tenant.localhost",
  });
  expect(usersResponse.status).toBe(200);
  const usersBody = await usersResponse.json();
  const pendingUser = usersBody.items.find(
    (user: { password_setup_pending: boolean }) => user.password_setup_pending === true,
  );
  expect(pendingUser).toBeDefined();

  const invitationResponse = await request(admin, "/api/invitations", {
    method: "POST",
    host: "tenant.localhost",
    body: { user: pendingUser.id, tenant: "caller-selected-tenant-is-ignored" },
  });
  expect(invitationResponse.status).toBe(200);
  const invitation = await invitationResponse.json();
  expect(invitation).toEqual({
    message: "If the invitation is eligible, an email will be sent.",
  });

  const rejectedInvitation = await request(admin, "/api/invitations", {
    method: "POST",
    host: "tenant.localhost",
    body: { user: "missing-user-id" },
  });
  expect(rejectedInvitation.status).toBe(403);
  expect(JSON.stringify(await rejectedInvitation.json())).not.toContain(pendingEmail);
  expect(JSON.stringify(invitation)).not.toContain(pendingEmail);

  const pendingLogin = await request(
    new PocketBase(harness.baseUrl),
    "/api/collections/users/auth-with-password",
    {
      method: "POST",
      host: "tenant.localhost",
      body: { identity: pendingEmail, password: adminPassword },
    },
  );
  expect(pendingLogin.status).toBe(403);

  const invalidPassword = await request(new PocketBase(harness.baseUrl), "/api/invitations/setup", {
    method: "POST",
    host: "tenant.localhost",
    body: { token: "x".repeat(64), password: "short" },
  });
  expect(invalidPassword.status).toBe(400);
});

it("completes setup only for the owning tenant, validates with PocketBase, and rejects reuse", async () => {
  const wrongTenant = await request(new PocketBase(harness.baseUrl), "/api/invitations/setup", {
    method: "POST",
    host: "other.localhost",
    body: { token: setupToken, password: setupPassword },
  });
  expect(wrongTenant.status).toBe(400);
  const wrongTenantBody = await wrongTenant.text();
  expect(wrongTenantBody).toContain("Invalid or expired invitation");
  expect(wrongTenantBody).not.toContain(setupToken);
  expect(wrongTenantBody).not.toContain(setupPassword);

  const invalidPassword = await request(new PocketBase(harness.baseUrl), "/api/invitations/setup", {
    method: "POST",
    host: "tenant.localhost",
    body: { token: setupToken, password: "short" },
  });
  expect(invalidPassword.status).toBe(400);

  const setup = await request(new PocketBase(harness.baseUrl), "/api/invitations/setup", {
    method: "POST",
    host: "tenant.localhost",
    body: { token: setupToken, password: setupPassword },
  });
  expect(setup.status).toBe(200);
  const setupBody = await setup.text();
  expect(setupBody).not.toContain(setupToken);
  expect(setupBody).not.toContain(setupPassword);
  expect(JSON.parse(setupBody)).toMatchObject({
    record: { email: pendingEmail, password_setup_pending: false },
  });

  const replay = await request(new PocketBase(harness.baseUrl), "/api/invitations/setup", {
    method: "POST",
    host: "tenant.localhost",
    body: { token: setupToken, password: setupPassword },
  });
  expect(replay.status).toBe(400);
  const replayBody = await replay.text();
  expect(replayBody).toContain("Invalid or expired invitation");
  expect(replayBody).not.toContain(setupToken);
  expect(replayBody).not.toContain(setupPassword);

  const login = await request(
    new PocketBase(harness.baseUrl),
    "/api/collections/users/auth-with-password",
    {
      method: "POST",
      host: "tenant.localhost",
      body: { identity: pendingEmail, password: setupPassword },
    },
  );
  expect(login.status).toBe(200);
});
