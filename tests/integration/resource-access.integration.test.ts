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
let migrationsDir: string;
let harness: PocketBaseIntegrationHarness;

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

async function authenticate(email: string, host: string): Promise<PocketBase> {
  const pocketbase = new PocketBase(harness.baseUrl);
  const response = await request(pocketbase, "/api/collections/users/auth-with-password", {
    method: "POST",
    host,
    body: { identity: email, password },
  });
  expect(response.status).toBe(200);
  const auth = await response.json();
  pocketbase.authStore.save(auth.token, auth.record);
  return pocketbase;
}

beforeAll(async () => {
  migrationsDir = await mkdtemp(resolve(tmpdir(), "asset-calendar-resource-access-"));
  await cp(productionMigrations, migrationsDir, { recursive: true });
  await writeFile(
    resolve(migrationsDir, "1710000007_resource_access_fixture.js"),
    `migrate((app) => {
  const tenants = app.findCollectionByNameOrId("tenants");
  const units = app.findCollectionByNameOrId("organizational_units");
  const users = app.findCollectionByNameOrId("users");
  const tenantA = new Record(tenants);
  tenantA.set("name", "Tenant A");
  tenantA.set("subdomain", "tenant");
  tenantA.set("currency", "DKK");
  tenantA.set("locale", "da-DK");
  app.save(tenantA);
  const tenantB = new Record(tenants);
  tenantB.set("name", "Tenant B");
  tenantB.set("subdomain", "other");
  tenantB.set("currency", "DKK");
  tenantB.set("locale", "da-DK");
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
    ["admin-a@example.test", tenantA.id, unitA.id, "administrator"],
    ["regular-a@example.test", tenantA.id, unitA.id, "regular"],
    ["admin-b@example.test", tenantB.id, unitB.id, "administrator"],
  ]) {
    const user = new Record(users);
    user.set("email", data[0]);
    user.set("password", ${JSON.stringify(password)});
    user.set("passwordConfirm", ${JSON.stringify(password)});
    user.set("tenant", data[1]);
    user.set("organizational_unit", data[2]);
    user.set("role", data[3]);
    user.set("active", true);
    user.set("password_setup_pending", false);
    app.save(user);
  }
}, () => {});`,
  );
  process.env.ASSET_CALENDAR_TENANT_HOSTS = "tenant.localhost,other.localhost";
  harness = await startPocketBaseIntegrationHarness({ migrationsDir });
}, 30_000);

afterAll(async () => {
  if (harness) await harness.stop();
  if (migrationsDir) await rm(migrationsDir, { recursive: true, force: true });
  delete process.env.ASSET_CALENDAR_TENANT_HOSTS;
});

it("enforces administrator tenant authorization and resource validation", async () => {
  const adminA = await authenticate("admin-a@example.test", "tenant.localhost");
  const adminB = await authenticate("admin-b@example.test", "other.localhost");
  const regularA = await authenticate("regular-a@example.test", "tenant.localhost");

  const tenantId = adminA.authStore.record?.tenant;
  if (typeof tenantId !== "string") throw new Error("Expected administrator tenant.");
  const currencyChange = await request(adminA, `/api/collections/tenants/records/${tenantId}`, {
    method: "PATCH",
    host: "tenant.localhost",
    body: { currency: "EUR" },
  });
  expect(currencyChange.status).toBe(403);

  const created = await request(adminA, "/api/collections/resources/records", {
    method: "POST",
    host: "tenant.localhost",
    body: { name: "  Meeting Room  ", base_rate_minor_units: 1250, archived: false },
  });
  expect(created.status).toBe(200);
  const resource = await created.json();
  expect(resource).toMatchObject({ name: "Meeting Room" });

  for (const body of [
    { name: "   ", base_rate_minor_units: 1, archived: false },
    { name: "Missing rate", archived: false },
    { name: "Negative", base_rate_minor_units: -1, archived: false },
    { name: "Decimal", base_rate_minor_units: 1.5, archived: false },
    { name: "Unsafe", base_rate_minor_units: Number.MAX_SAFE_INTEGER + 1, archived: false },
  ]) {
    const response = await request(adminA, "/api/collections/resources/records", {
      method: "POST",
      host: "tenant.localhost",
      body,
    });
    expect(response.status).toBe(400);
  }

  const duplicate = await request(adminA, "/api/collections/resources/records", {
    method: "POST",
    host: "tenant.localhost",
    body: { name: " meeting ROOM ", base_rate_minor_units: 1, archived: false },
  });
  expect(duplicate.status).toBe(400);
  const sameNameOtherTenant = await request(adminB, "/api/collections/resources/records", {
    method: "POST",
    host: "other.localhost",
    body: { name: " meeting ROOM ", base_rate_minor_units: 1, archived: false },
  });
  expect(sameNameOtherTenant.status).toBe(200);

  const regularCreate = await request(regularA, "/api/collections/resources/records", {
    method: "POST",
    host: "tenant.localhost",
    body: { name: "Regular Room", base_rate_minor_units: 1, archived: false },
  });
  expect(regularCreate.status).toBeGreaterThanOrEqual(400);

  const crossTenantUpdate = await request(
    adminB,
    `/api/collections/resources/records/${resource.id}`,
    {
      method: "PATCH",
      host: "other.localhost",
      body: { name: "Stolen Room", base_rate_minor_units: 1, archived: false },
    },
  );
  expect(crossTenantUpdate.status).toBeGreaterThanOrEqual(400);
});

it("archives resources one way and projects rates only to administrators", async () => {
  const admin = await authenticate("admin-a@example.test", "tenant.localhost");
  const regular = await authenticate("regular-a@example.test", "tenant.localhost");
  const created = await request(admin, "/api/collections/resources/records", {
    method: "POST",
    host: "tenant.localhost",
    body: { name: "Archive Room", base_rate_minor_units: 900, archived: false },
  });
  const resource = await created.json();

  const archived = await request(admin, `/api/collections/resources/records/${resource.id}`, {
    method: "PATCH",
    host: "tenant.localhost",
    body: { name: "Archive Room", base_rate_minor_units: 900, archived: true },
  });
  expect(archived.status).toBe(200);

  const activeAdmin = await request(admin, "/api/resources/active", { host: "tenant.localhost" });
  expect(
    (await activeAdmin.json()).items.some((item: { id: string }) => item.id === resource.id),
  ).toBe(false);
  const allAdmin = await request(admin, "/api/resources", { host: "tenant.localhost" });
  expect((await allAdmin.json()).items).toContainEqual(
    expect.objectContaining({ id: resource.id, archived: true, base_rate_minor_units: 900 }),
  );

  const regularAll = await request(regular, "/api/resources", { host: "tenant.localhost" });
  const regularItems = (await regularAll.json()).items;
  expect(regularItems).toEqual(
    expect.not.arrayContaining([expect.objectContaining({ id: resource.id })]),
  );
  expect(
    regularItems.every((item: Record<string, unknown>) => !("base_rate_minor_units" in item)),
  ).toBe(true);
  expect(JSON.stringify(regularItems)).not.toContain("base_rate_minor_units");

  const unarchive = await request(admin, `/api/collections/resources/records/${resource.id}`, {
    method: "PATCH",
    host: "tenant.localhost",
    body: { name: "Archive Room", base_rate_minor_units: 900, archived: false },
  });
  expect(unarchive.status).toBe(403);
  const archivedUpdate = await request(admin, `/api/collections/resources/records/${resource.id}`, {
    method: "PATCH",
    host: "tenant.localhost",
    body: { name: "Changed After Archive", base_rate_minor_units: 901, archived: true },
  });
  expect(archivedUpdate.status).toBe(403);
});
