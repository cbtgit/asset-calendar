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
    { email: "pending-a@example.test", tenant: tenantA.id, unit: unitA.id, role: "regular", active: true, pending: true },
  ]) {
    const user = new Record(users);
    user.set("email", data.email);
    user.set("password", ${JSON.stringify(password)});
    user.set("passwordConfirm", ${JSON.stringify(password)});
    user.set("tenant", data.tenant);
    user.set("organizational_unit", data.unit);
    user.set("role", data.role);
    user.set("active", data.active);
    user.set("password_setup_pending", data.pending === true);
    app.save(user);
  }
}, () => {});`,
  );
  await writeFile(
    resolve(migrationsDir, "1710000006_auth_groups_sort_fixture.js"),
    `migrate((app) => {
  const units = app.findCollectionByNameOrId("organizational_units");
  const tenant = app.findRecordsByFilter("tenants", "subdomain = 'tenant'", "", 1, 0)[0];
  for (const name of ["banana", "Cherry", "apple", "Date"]) {
    const unit = new Record(units);
    unit.set("tenant", tenant.id);
    unit.set("name", name);
    unit.set("name_normalized", name.toLowerCase());
    app.save(unit);
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

async function createBookingType(
  pocketbase: PocketBase,
  tenant: string,
  name: string,
  host = "tenant.localhost",
): Promise<Response> {
  const response = await request(pocketbase, "/api/collections/booking_types/records", {
    method: "POST",
    host,
    body: {
      tenant,
      name,
      surcharge_minor_units: 1250,
    },
  });
  return response;
}

async function createResource(
  pocketbase: PocketBase,
  tenant: string | undefined,
  name: string,
  baseRateMinorUnits = 1250,
  host = "tenant.localhost",
  extra: Record<string, unknown> = {},
): Promise<Response> {
  return request(pocketbase, "/api/collections/resources/records", {
    method: "POST",
    host,
    body: {
      ...(tenant === undefined ? {} : { tenant }),
      name,
      base_rate_minor_units: baseRateMinorUnits,
      ...extra,
    },
  });
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

// oxlint-disable-next-line eslint(max-lines-per-function)
it("enforces resource reads, writes, validation, and server-managed fields", async () => {
  const admin = new PocketBase(harness.baseUrl);
  await authenticate(admin, "admin-a@example.test");
  const authRecord = admin.authStore.model;
  if (!authRecord) throw new Error("Expected the administrator auth record.");

  const adminB = new PocketBase(harness.baseUrl);
  await authenticate(adminB, "admin-b@example.test", "other.localhost");
  const otherAuthRecord = adminB.authStore.model;
  if (!otherAuthRecord) throw new Error("Expected the second administrator auth record.");

  const regular = new PocketBase(harness.baseUrl);
  await authenticate(regular, "regular-a@example.test");

  const emptyRead = await request(regular, "/api/collections/resources/records", {
    host: "tenant.localhost",
  });
  expect(emptyRead.status).toBe(200);
  expect((await emptyRead.json()).items).toHaveLength(0);

  const wrongTenant = await createResource(
    admin,
    otherAuthRecord.tenant,
    "Wrong tenant",
    1250,
    "tenant.localhost",
  );
  expect(wrongTenant.status).toBe(403);

  const normalizedOverride = await createResource(
    admin,
    authRecord.tenant,
    "Protected name",
    1250,
    "tenant.localhost",
    { name_normalized: "injected" },
  );
  expect(normalizedOverride.status).toBe(403);

  const archivedOverride = await createResource(
    admin,
    authRecord.tenant,
    "Protected archive",
    1250,
    "tenant.localhost",
    { archived_at: "2026-01-01 00:00:00.000Z" },
  );
  expect(archivedOverride.status).toBe(403);

  const invalidName = await createResource(admin, authRecord.tenant, "   ");
  expect([400, 403]).toContain(invalidName.status);
  const negativeRate = await createResource(admin, authRecord.tenant, "Negative", -1);
  expect([400, 403]).toContain(negativeRate.status);
  const unsafeRate = await createResource(admin, authRecord.tenant, "Unsafe", 9007199254740992);
  expect([400, 403]).toContain(unsafeRate.status);

  const created = await createResource(admin, undefined, "  Room A  ", 1250);
  expect(created.status).toBe(200);
  const resource = await created.json();
  expect(resource).toMatchObject({
    name: "Room A",
    base_rate_minor_units: 1250,
    tenant: authRecord.tenant,
    archived_at: "",
  });

  const regularRead = await request(regular, "/api/collections/resources/records", {
    host: "tenant.localhost",
  });
  expect(regularRead.status).toBe(200);
  expect((await regularRead.json()).items).toHaveLength(1);

  const regularWrite = await createResource(regular, undefined, "Unauthorized");
  expect(regularWrite.status).toBe(400);

  const duplicate = await createResource(admin, undefined, "room a");
  expect(duplicate.status).toBe(400);
  const otherTenantResource = await createResource(
    adminB,
    undefined,
    "Room A",
    1500,
    "other.localhost",
  );
  expect(otherTenantResource.status).toBe(200);
  const foreign = await otherTenantResource.json();
  const crossTenantView = await request(admin, `/api/collections/resources/records/${foreign.id}`, {
    host: "tenant.localhost",
  });
  expect(crossTenantView.status).toBe(404);

  const updated = await request(admin, `/api/collections/resources/records/${resource.id}`, {
    method: "PATCH",
    host: "tenant.localhost",
    body: { name: "Updated room", base_rate_minor_units: 1500 },
  });
  expect(updated.status).toBe(200);
  expect((await updated.json()).archived_at).toBe("");

  const archiveUpdate = await request(admin, `/api/collections/resources/records/${resource.id}`, {
    method: "PATCH",
    host: "tenant.localhost",
    body: { archived_at: "2026-01-01 00:00:00.000Z" },
  });
  expect(archiveUpdate.status).toBe(403);
});

// oxlint-disable-next-line eslint(max-lines-per-function)
it("enforces the resolved tenant and role boundary on direct requests", async () => {
  const admin = new PocketBase(harness.baseUrl);
  await authenticate(admin, "admin-a@example.test");

  const groupsResponse = await request(admin, "/api/groups", { host: "tenant.localhost" });
  expect(groupsResponse.status).toBe(200);
  expect(await groupsResponse.json()).toMatchObject({
    items: [
      {
        name: "apple",
        member_count: 0,
      },
      {
        name: "banana",
        member_count: 0,
      },
      {
        name: "Cherry",
        member_count: 0,
      },
      {
        name: "Date",
        member_count: 0,
      },
      {
        name: "Unit A",
        member_count: 4,
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
  expect(await directGroup.json()).toMatchObject({ id: groupId, name: "Unit A", member_count: 4 });

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
  expect(normalizedOverride.status).toBe(403);
  const groupsAfterOverride = await request(admin, "/api/groups", { host: "tenant.localhost" });
  expect((await groupsAfterOverride.json()).items).not.toContainEqual(
    expect.objectContaining({ name: "Override" }),
  );

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
  const regularUserBookingTypes = await request(regular, "/api/collections/booking_types/records", {
    host: "tenant.localhost",
  });
  expect(regularUserBookingTypes.status).toBe(200);
  expect((await regularUserBookingTypes.json()).items).toHaveLength(0);
  const regularUserBookingTypeCreate = await request(
    regular,
    "/api/collections/booking_types/records",
    {
      method: "POST",
      host: "tenant.localhost",
      body: {
        tenant: groupRecord.tenant,
        name: "Unauthorized booking type",
        surcharge_minor_units: 1250,
      },
    },
  );
  expect(regularUserBookingTypeCreate.status).toBe(400);

  const rawUsersResponse = await request(
    admin,
    "/api/collections/users/records?page=1&perPage=50",
    {
      host: "tenant.localhost",
    },
  );
  expect(rawUsersResponse.status).toBe(403);

  const usersResponse = await request(admin, "/api/users", { host: "tenant.localhost" });
  expect(usersResponse.status).toBe(200);
  const users = await usersResponse.json();
  expect(users.items).toHaveLength(4);
  expect(users.items[0]).toEqual(
    expect.objectContaining({
      email: expect.any(String),
      group: expect.any(String),
      role: expect.any(String),
      active: expect.any(Boolean),
    }),
  );
  expect(users.items[0]).not.toHaveProperty("tenant");
  expect(users.items[0]).not.toHaveProperty("email_normalized");

  const foreignFilter = await request(admin, "/api/users?filter=tenant='foreign-tenant'", {
    host: "tenant.localhost",
  });
  expect(foreignFilter.status).toBe(200);
  expect((await foreignFilter.json()).items).toHaveLength(4);

  const foreignHost = await request(admin, "/api/users", {
    host: "other.localhost",
  });

  const unknownHost = await request(admin, "/api/users", {
    host: "missing.localhost",
  });
  const rootHost = await request(admin, "/api/users", {
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
  expect(ownUpdate.status).toBe(403);

  const deactivate = await request(admin, `/api/users/${regularRecord.id}`, {
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

it("manages users through projections and keeps active selection separate", async () => {
  const admin = new PocketBase(harness.baseUrl);
  await authenticate(admin, "admin-a@example.test");
  const authRecord = admin.authStore.model;
  if (!authRecord) throw new Error("Expected the administrator auth record.");

  const createdResponse = await request(admin, "/api/users", {
    method: "POST",
    host: "tenant.localhost",
    body: {
      first_name: "  New  ",
      last_name: "  Person  ",
      email: "  New.Person@Example.Test  ",
      group: authRecord.organizational_unit,
      role: "administrator",
      tenant: "client-selected-tenant-is-ignored",
    },
  });
  expect(createdResponse.status).toBe(200);
  const created = await createdResponse.json();
  expect(created).toMatchObject({
    first_name: "New",
    last_name: "Person",
    display_name: "New Person",
    email: "new.person@example.test",
    group: authRecord.organizational_unit,
    role: "administrator",
    active: true,
    password_setup_pending: true,
  });
  expect(created).not.toHaveProperty("tenant");
  expect(created).not.toHaveProperty("email_normalized");
  expect(created).not.toHaveProperty("password");
  expect(created).not.toHaveProperty("tokenKey");

  const activeBeforeDeactivation = await request(admin, "/api/users/active", {
    host: "tenant.localhost",
  });
  expect(activeBeforeDeactivation.status).toBe(200);
  expect((await activeBeforeDeactivation.json()).items).toContainEqual(
    expect.objectContaining({ id: created.id, email: "new.person@example.test" }),
  );

  const emailChange = await request(admin, `/api/users/${created.id}`, {
    method: "PATCH",
    host: "tenant.localhost",
    body: { email: "changed@example.test" },
  });
  expect(emailChange.status).toBe(403);

  const deactivated = await request(admin, `/api/users/${created.id}`, {
    method: "PATCH",
    host: "tenant.localhost",
    body: { active: false, role: "regular" },
  });
  expect(deactivated.status).toBe(200);
  expect(await deactivated.json()).toMatchObject({ active: false, role: "regular" });

  const activeAfterDeactivation = await request(admin, "/api/users/active", {
    host: "tenant.localhost",
  });
  expect((await activeAfterDeactivation.json()).items).not.toContainEqual(
    expect.objectContaining({ id: created.id }),
  );

  const reactivated = await request(admin, `/api/users/${created.id}`, {
    method: "PATCH",
    host: "tenant.localhost",
    body: { active: true },
  });
  expect(reactivated.status).toBe(200);

  const resend = await request(admin, `/api/users/${created.id}`, {
    method: "PATCH",
    host: "tenant.localhost",
    body: { action: "resend_invitation" },
  });
  expect(resend.status).toBe(200);

  const duplicate = await request(admin, "/api/users", {
    method: "POST",
    host: "tenant.localhost",
    body: {
      first_name: "Another",
      last_name: "Person",
      email: " NEW.PERSON@example.test ",
      group: authRecord.organizational_unit,
      role: "regular",
    },
  });
  expect(duplicate.status).toBe(400);
  expect((await duplicate.text()).toLowerCase()).toContain("email_already_exists");
});

it("derives booking type normalization on the server", async () => {
  const admin = new PocketBase(harness.baseUrl);
  await authenticate(admin, "admin-a@example.test");
  const authRecord = admin.authStore.model;
  if (!authRecord) throw new Error("Expected the administrator auth record.");

  const adminB = new PocketBase(harness.baseUrl);
  await authenticate(adminB, "admin-b@example.test", "other.localhost");
  const otherAuthRecord = adminB.authStore.model;
  if (!otherAuthRecord) throw new Error("Expected the second administrator auth record.");

  const wrongTenantCreate = await request(admin, "/api/collections/booking_types/records", {
    method: "POST",
    host: "tenant.localhost",
    body: {
      tenant: otherAuthRecord.tenant,
      name: "Wrong tenant",
      surcharge_minor_units: 1250,
    },
  });
  expect(wrongTenantCreate.status).toBe(400);

  const normalizedOverride = await request(admin, "/api/collections/booking_types/records", {
    method: "POST",
    host: "tenant.localhost",
    body: {
      tenant: authRecord.tenant,
      name: "Protected normalized name",
      name_normalized: "injected",
      surcharge_minor_units: 1250,
    },
  });
  expect(normalizedOverride.status).toBe(403);

  const beforeAuthorizedCreate = await request(admin, "/api/collections/booking_types/records", {
    host: "tenant.localhost",
  });
  expect((await beforeAuthorizedCreate.json()).items).toHaveLength(0);

  const created = await createBookingType(admin, authRecord.tenant, "  Training  ");
  expect(created.status).toBe(200);
  const createdBookingType = await created.json();
  expect(createdBookingType).toMatchObject({
    name: "Training",
    tenant: authRecord.tenant,
  });

  const otherCreated = await createBookingType(
    adminB,
    otherAuthRecord.tenant,
    "Other training",
    "other.localhost",
  );
  expect(otherCreated.status).toBe(200);
  const otherBookingType = await otherCreated.json();

  const crossTenantView = await request(
    admin,
    `/api/collections/booking_types/records/${otherBookingType.id}`,
    { host: "tenant.localhost" },
  );
  expect(crossTenantView.status).toBe(404);

  const crossTenantUpdate = await request(
    admin,
    `/api/collections/booking_types/records/${otherBookingType.id}`,
    {
      method: "PATCH",
      host: "tenant.localhost",
      body: { name: "Unauthorized update", surcharge_minor_units: 2000 },
    },
  );
  expect(crossTenantUpdate.status).toBe(404);

  const otherAfterUpdate = await request(
    adminB,
    `/api/collections/booking_types/records/${otherBookingType.id}`,
    { host: "other.localhost" },
  );
  expect((await otherAfterUpdate.json()).name).toBe("Other training");

  const duplicate = await createBookingType(admin, authRecord.tenant, "training");
  expect(duplicate.status).toBe(400);
});
