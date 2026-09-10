// @vitest-environment node
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
const password = "Correct horse battery staple!";

let harness: PocketBaseIntegrationHarness;
let migrationsDir: string;

async function createSeededMigrations(): Promise<string> {
  migrationsDir = await mkdtemp(resolve(tmpdir(), "asset-calendar-auth-migrations-"));
  await cp(productionMigrations, migrationsDir, { recursive: true });
  await writeFile(
    resolve(migrationsDir, "1710000004_auth_enforcement_fixture.js"),
    `migrate((app) => {
  const tenants = app.findCollectionByNameOrId("tenants");
  const units = app.findCollectionByNameOrId("organizational_units");
  const users = app.findCollectionByNameOrId("users");
  const tenantA = new Record(tenants);
  tenantA.set("name", "Tenant A");
  tenantA.set("subdomain", "tenant");
  app.save(tenantA);
  const tenantB = new Record(tenants);
  tenantB.set("name", "Tenant B");
  tenantB.set("subdomain", "other");
  app.save(tenantB);
  const unitA = new Record(units);
  unitA.set("tenant", tenantA.id);
  unitA.set("name", "Unit A");
  unitA.set("name_normalized", "unit a");
  app.save(unitA);
  const unitB = new Record(units);
  unitB.set("tenant", tenantB.id);
  unitB.set("name", "Unit B");
  unitB.set("name_normalized", "unit b");
  app.save(unitB);
  for (const data of [
    { email: "admin-a@example.test", tenant: tenantA.id, unit: unitA.id, role: "administrator", active: true },
    { email: "regular-a@example.test", tenant: tenantA.id, unit: unitA.id, role: "regular", active: true },
    { email: "admin-b@example.test", tenant: tenantB.id, unit: unitB.id, role: "administrator", active: true },
    { email: "inactive-a@example.test", tenant: tenantA.id, unit: unitA.id, role: "regular", active: false },
  ]) {
    const user = new Record(users);
    user.set("email", data.email);
    user.set("password", ${JSON.stringify(password)});
    user.set("passwordConfirm", ${JSON.stringify(password)});
    user.set("tenant", data.tenant);
    user.set("organizational_unit", data.unit);
    user.set("role", data.role);
    user.set("active", data.active);
    user.set("password_setup_pending", false);
    app.save(user);
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

async function authenticate(
  pocketbase: PocketBase,
  email: string,
  host = "tenant.localhost",
): Promise<void> {
  const response = await request(pocketbase, "/api/collections/users/auth-with-password", {
    method: "POST",
    host,
    body: { identity: email, password },
  });
  expect(response.status).toBe(200);
  const auth = await response.json();
  pocketbase.authStore.save(auth.token, auth.record);
}

const originalTenantHosts = process.env.ASSET_CALENDAR_TENANT_HOSTS;

beforeAll(async () => {
  process.env.ASSET_CALENDAR_TENANT_HOSTS = "tenant.localhost,other.localhost";
  harness = await startPocketBaseIntegrationHarness({
    migrationsDir: await createSeededMigrations(),
  });
});

afterAll(async () => {
  if (harness) await harness.stop();
  if (migrationsDir) await rm(migrationsDir, { recursive: true, force: true });
  if (originalTenantHosts === undefined) {
    delete process.env.ASSET_CALENDAR_TENANT_HOSTS;
  } else {
    process.env.ASSET_CALENDAR_TENANT_HOSTS = originalTenantHosts;
  }
});

it("enforces the resolved tenant and role boundary on direct requests", async () => {
  const admin = new PocketBase(harness.baseUrl);
  await authenticate(admin, "admin-a@example.test");

  const groupsResponse = await request(admin, "/api/groups", { host: "tenant.localhost" });
  expect(groupsResponse.status).toBe(200);
  expect(await groupsResponse.json()).toMatchObject({
    items: [
      {
        name: "Unit A",
        member_count: 3,
      },
    ],
  });

  const groupRecord = admin.authStore.model;
  if (!groupRecord) throw new Error("Expected the administrator auth record.");
  const groupId = groupRecord.organizational_unit;
  const trimmedGroup = await request(admin, "/api/collections/organizational_units/records", {
    method: "POST",
    host: "tenant.localhost",
    body: { name: "  Trimmed group  " },
  });
  expect(trimmedGroup.status).toBe(200);
  expect((await trimmedGroup.json()).name).toBe("Trimmed group");

  const directGroup = await request(admin, `/api/groups/${groupId}`, { host: "tenant.localhost" });
  expect(directGroup.status).toBe(200);
  expect(await directGroup.json()).toMatchObject({ id: groupId, name: "Unit A", member_count: 3 });

  const duplicateGroup = await request(admin, "/api/collections/organizational_units/records", {
    method: "POST",
    host: "tenant.localhost",
    body: { name: " unit a " },
  });
  expect(duplicateGroup.status).toBe(400);

  const normalizedOverride = await request(admin, "/api/collections/organizational_units/records", {
    method: "POST",
    host: "tenant.localhost",
    body: { name: "Override", name_normalized: "unit a" },
  });
  expect(normalizedOverride.status).toBe(200);
  expect((await normalizedOverride.json()).name).toBe("Override");

  const blankGroup = await request(admin, "/api/collections/organizational_units/records", {
    method: "POST",
    host: "tenant.localhost",
    body: { name: "   " },
  });
  expect(blankGroup.status).toBe(400);

  const longGroup = await request(admin, "/api/collections/organizational_units/records", {
    method: "POST",
    host: "tenant.localhost",
    body: { name: "x".repeat(201) },
  });
  expect(longGroup.status).toBe(400);

  const otherAdmin = new PocketBase(harness.baseUrl);
  await authenticate(otherAdmin, "admin-b@example.test", "other.localhost");
  const sameNameOtherTenant = await request(
    otherAdmin,
    "/api/collections/organizational_units/records",
    {
      method: "POST",
      host: "other.localhost",
      body: { name: " unit a " },
    },
  );
  expect(sameNameOtherTenant.status).toBe(200);
  const otherGroup = await sameNameOtherTenant.json();
  const crossTenantView = await request(admin, `/api/groups/${otherGroup.id}`, {
    host: "tenant.localhost",
  });
  expect(crossTenantView.status).toBe(404);

  const foreignGroup = await request(
    admin,
    `/api/collections/organizational_units/records/${groupId}`,
    {
      method: "PATCH",
      host: "tenant.localhost",
      body: { tenant: "foreign-tenant" },
    },
  );
  expect(foreignGroup.status).toBe(403);

  const assignedGroupDelete = await request(
    admin,
    `/api/collections/organizational_units/records/${groupId}`,
    { method: "DELETE", host: "tenant.localhost" },
  );
  expect(assignedGroupDelete.status).toBe(400);

  const regular = new PocketBase(harness.baseUrl);
  await authenticate(regular, "regular-a@example.test");
  const regularGroups = await request(regular, "/api/groups", { host: "tenant.localhost" });
  expect(regularGroups.status).toBe(403);

  const usersResponse = await request(admin, "/api/collections/users/records?page=1&perPage=50", {
    host: "tenant.localhost",
  });
  expect(usersResponse.status).toBe(200);
  const users = await usersResponse.json();
  expect(users.items).toHaveLength(3);

  const foreignFilter = await request(
    admin,
    "/api/collections/users/records?filter=tenant='foreign-tenant'",
    { host: "tenant.localhost" },
  );
  expect(foreignFilter.status).toBe(200);
  expect((await foreignFilter.json()).items).toHaveLength(0);

  const foreignHost = await request(admin, "/api/collections/users/records", {
    host: "other.localhost",
  });

  const unknownHost = await request(admin, "/api/collections/users/records", {
    host: "missing.localhost",
  });
  const rootHost = await request(admin, "/api/collections/users/records", {
    host: "localhost",
  });
  expect([foreignHost.status, unknownHost.status, rootHost.status]).toEqual([403, 403, 403]);
  const [foreignBody, unknownBody, rootBody] = await Promise.all([
    foreignHost.json(),
    unknownHost.json(),
    rootHost.json(),
  ]);
  expect(foreignBody).toEqual(unknownBody);
  expect(unknownBody).toEqual(rootBody);
  const regularRecord = regular.authStore.model;
  if (!regularRecord) throw new Error("Expected the regular user auth record.");
  const protectedUpdate = await request(
    regular,
    `/api/collections/users/records/${regularRecord.id}`,
    {
      method: "PATCH",
      host: "tenant.localhost",
      body: {
        role: "administrator",
        tenant: "foreign-tenant",
        active: false,
        organizational_unit: "foreign-unit",
        password_setup_pending: true,
      },
    },
  );
  expect(protectedUpdate.status).toBe(403);

  const ownUpdate = await request(regular, `/api/collections/users/records/${regularRecord.id}`, {
    method: "PATCH",
    host: "tenant.localhost",
    body: { first_name: "Updated" },
  });
  expect(ownUpdate.status).toBe(200);

  const deactivate = await request(admin, `/api/collections/users/records/${regularRecord.id}`, {
    method: "PATCH",
    host: "tenant.localhost",
    body: { active: false },
  });
  expect(deactivate.status).toBe(200);
  const inactiveLogin = new PocketBase(harness.baseUrl);
  const inactiveResponse = await request(
    inactiveLogin,
    "/api/collections/users/auth-with-password",
    {
      method: "POST",
      host: "tenant.localhost",
      body: { identity: "regular-a@example.test", password },
    },
  );
  expect(inactiveResponse.status).toBe(403);

  const inactiveRequest = await request(regular, "/api/collections/users/records", {
    host: "tenant.localhost",
  });
  expect(inactiveRequest.status).toBe(403);
});
