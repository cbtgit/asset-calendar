// @vitest-environment node
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
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
  migrationsDir = await mkdtemp(resolve(tmpdir(), "asset-calendar-bookings-"));
  await cp(productionMigrations, migrationsDir, { recursive: true });
  await writeFile(
    resolve(migrationsDir, "1710000011_f08_bookings_fixture.js"),
    `migrate((app) => {
  const tenants = app.findCollectionByNameOrId("tenants");
  const units = app.findCollectionByNameOrId("organizational_units");
  const users = app.findCollectionByNameOrId("users");
  const resources = app.findCollectionByNameOrId("resources");

  const tenant = new Record(tenants);
  tenant.set("name", "Tenant A");
  tenant.set("subdomain", "tenant");
  app.save(tenant);

  const unit = new Record(units);
  unit.set("tenant", tenant.id);
  unit.set("name", "Unit A");
  unit.set("name_normalized", "unit a");
  app.save(unit);

  for (const data of [
    { email: "admin-a@example.test", first_name: "Admin", last_name: "A", role: "administrator" },
    { email: "regular-a@example.test", first_name: "Regular", last_name: "A", role: "regular" },
  ]) {
    const user = new Record(users);
    user.set("email", data.email);
    user.set("email_normalized", data.email);
    user.set("password", ${JSON.stringify(password)});
    user.set("passwordConfirm", ${JSON.stringify(password)});
    user.set("tenant", tenant.id);
    user.set("organizational_unit", unit.id);
    user.set("first_name", data.first_name);
    user.set("last_name", data.last_name);
    user.set("role", data.role);
    user.set("active", true);
    user.set("password_setup_pending", false);
    app.save(user);
  }

  for (const data of [
    { name: "Room A", archived_at: "" },
    { name: "Archived Room", archived_at: "2026-01-01 00:00:00.000Z" },
  ]) {
    const resource = new Record(resources);
    resource.set("tenant", tenant.id);
    resource.set("name", data.name);
    resource.set("name_normalized", data.name.toLowerCase());
    resource.set("base_rate_minor_units", 1500);
    resource.set("archived_at", data.archived_at);
    app.save(resource);
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

async function authenticate(pocketbase: PocketBase, email: string): Promise<void> {
  const response = await request(pocketbase, "/api/collections/users/auth-with-password", {
    method: "POST",
    host: "tenant.localhost",
    body: { identity: email, password },
  });
  expect(response.status).toBe(200);
  const auth = await response.json();
  pocketbase.authStore.save(auth.token, auth.record);
}

async function authenticateSuperuser(pocketbase: PocketBase): Promise<void> {
  const response = await request(pocketbase, "/api/collections/_superusers/auth-with-password", {
    method: "POST",
    body: {
      identity: harness.superuser.email,
      password: harness.superuser.password,
    },
  });
  expect(response.status).toBe(200);
  const auth = await response.json();
  pocketbase.authStore.save(auth.token, auth.record);
}

async function createBooking(
  pocketbase: PocketBase,
  body: Record<string, unknown>,
): Promise<Response> {
  return request(pocketbase, "/api/calendar/bookings", {
    method: "POST",
    host: "tenant.localhost",
    body,
  });
}

const originalTenantHosts = process.env.ASSET_CALENDAR_TENANT_HOSTS;

beforeAll(async () => {
  process.env.ASSET_CALENDAR_TENANT_HOSTS = "tenant.localhost";
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

it("creates role-safe bookings with snapshots and end-exclusive conflicts", async () => {
  const admin = new PocketBase(harness.baseUrl);
  await authenticate(admin, "admin-a@example.test");
  const adminRecord = admin.authStore.model;
  if (!adminRecord) throw new Error("Expected the administrator auth record.");

  const regular = new PocketBase(harness.baseUrl);
  await authenticate(regular, "regular-a@example.test");
  const regularRecord = regular.authStore.model;
  if (!regularRecord) throw new Error("Expected the regular user auth record.");

  const resourcesResponse = await request(admin, "/api/collections/resources/records", {
    host: "tenant.localhost",
  });
  expect(resourcesResponse.status).toBe(200);
  const resources = (await resourcesResponse.json()).items;
  const resource = resources.find((item: { name: string }) => item.name === "Room A");
  const archivedResource = resources.find(
    (item: { name: string }) => item.name === "Archived Room",
  );
  if (!resource || !archivedResource) throw new Error("Expected booking test resources.");
  expect(resource.archived_at).toBe("");

  const bookingTypeResponse = await request(admin, "/api/collections/booking_types/records", {
    method: "POST",
    host: "tenant.localhost",
    body: {
      tenant: adminRecord.tenant,
      name: "Training",
      surcharge_minor_units: 1250,
    },
  });
  expect(bookingTypeResponse.status).toBe(200);
  const bookingType = await bookingTypeResponse.json();

  const regularBooking = await createBooking(regular, {
    resource: resource.id,
    start: "2026-11-30T09:00:00.000Z",
    end: "2026-11-30T10:00:00.000Z",
  });
  expect(regularBooking.status).toBe(200);
  const regularBookingBody = await regularBooking.json();
  expect(regularBookingBody).toMatchObject({
    id: expect.any(String),
    resource: resource.id,
    booker_display_name: "Regular A",
  });
  expect(regularBookingBody).not.toHaveProperty("tenant");
  expect(regularBookingBody).not.toHaveProperty("resource_base_rate_minor_units");
  expect(regularBookingBody).not.toHaveProperty("effective_rate_minor_units");
  expect(regularBookingBody).not.toHaveProperty("booker_email_snapshot");

  const foreignOwner = await createBooking(regular, {
    resource: resource.id,
    booked_for_user: adminRecord.id,
    start: "2026-11-30T10:00:00.000Z",
    end: "2026-11-30T11:00:00.000Z",
  });
  expect(foreignOwner.status).toBe(403);

  const privilegedType = await createBooking(regular, {
    resource: resource.id,
    booking_type: bookingType.id,
    start: "2026-11-30T10:00:00.000Z",
    end: "2026-11-30T11:00:00.000Z",
  });
  expect(privilegedType.status).toBe(403);

  const invalidAlignment = await createBooking(regular, {
    resource: resource.id,
    start: "2026-11-30T10:05:00.000Z",
    end: "2026-11-30T11:00:00.000Z",
  });
  expect(invalidAlignment.status).toBe(400);

  const adjacentBooking = await createBooking(regular, {
    resource: resource.id,
    start: "2026-11-30T10:00:00.000Z",
    end: "2026-11-30T11:00:00.000Z",
  });
  expect(adjacentBooking.status).toBe(200);

  const overlap = await createBooking(regular, {
    resource: resource.id,
    start: "2026-11-30T10:45:00.000Z",
    end: "2026-11-30T11:45:00.000Z",
  });
  expect(overlap.status).toBe(400);

  const administratorBooking = await createBooking(admin, {
    resource: resource.id,
    booked_for_user: regularRecord.id,
    booking_type: bookingType.id,
    start: "2026-11-30T12:00:00.000Z",
    end: "2026-11-30T13:00:00.000Z",
  });
  expect(administratorBooking.status).toBe(200);
  const administratorBookingBody = await administratorBooking.json();
  expect(administratorBookingBody).toMatchObject({
    resource: resource.id,
    booked_for_user: regularRecord.id,
    created_by_user: adminRecord.id,
    booking_type: bookingType.id,
    booking_type_name: "Training",
  });
  expect(administratorBookingBody).not.toHaveProperty("effective_rate_minor_units");

  const privileged = new PocketBase(harness.baseUrl);
  await authenticateSuperuser(privileged);
  const storedBookings = await request(privileged, "/api/collections/bookings/records", {
    host: "tenant.localhost",
  });
  expect(storedBookings.status).toBe(200);
  const storedBooking = (await storedBookings.json()).items.find(
    (item: { id: string }) => item.id === regularBookingBody.id,
  );
  expect(storedBooking).toMatchObject({
    tenant: adminRecord.tenant,
    resource: resource.id,
    booked_for_user: regularRecord.id,
    created_by_user: regularRecord.id,
    resource_base_rate_minor_units: 1500,
    booking_type_surcharge_minor_units: 0,
    effective_rate_minor_units: 1500,
    booker_display_name_snapshot: "Regular A",
    booker_group_snapshot: "Unit A",
    booker_email_snapshot: "regular-a@example.test",
    resource_name_snapshot: "Room A",
    booking_type_name_snapshot: "",
  });

  const regularVisible = await request(
    regular,
    "/api/calendar/bookings?resource=" +
      encodeURIComponent(resource.id) +
      "&start=2026-11-30T08:00:00.000Z&end=2026-11-30T14:00:00.000Z",
    { host: "tenant.localhost" },
  );
  expect(regularVisible.status).toBe(200);
  const regularVisibleBody = await regularVisible.json();
  expect(regularVisibleBody.items).toHaveLength(3);
  expect(regularVisibleBody.items[0]).toMatchObject({
    resource: resource.id,
    booker_display_name: "Regular A",
  });
  expect(regularVisibleBody.items[0]).not.toHaveProperty("booking_type_name");
  expect(regularVisibleBody.items[0]).not.toHaveProperty("effective_rate_minor_units");

  const administratorVisible = await request(
    admin,
    "/api/calendar/bookings?resource=" +
      encodeURIComponent(resource.id) +
      "&start=2026-11-30T08:00:00.000Z&end=2026-11-30T14:00:00.000Z",
    { host: "tenant.localhost" },
  );
  expect(administratorVisible.status).toBe(200);
  expect((await administratorVisible.json()).items).toContainEqual(
    expect.objectContaining({ booking_type_name: "Training" }),
  );

  const regularUpdate = await request(regular, `/api/calendar/bookings/${regularBookingBody.id}`, {
    method: "PATCH",
    host: "tenant.localhost",
    body: {
      start: "2026-12-01T09:00:00.000Z",
      end: "2026-12-01T10:00:00.000Z",
    },
  });
  expect(regularUpdate.status).toBe(200);
  expect(await regularUpdate.json()).toMatchObject({
    id: regularBookingBody.id,
    start: "2026-12-01 09:00:00.000Z",
    can_edit: true,
    can_delete: true,
  });

  const regularResourceChange = await request(
    regular,
    `/api/calendar/bookings/${regularBookingBody.id}`,
    {
      method: "PATCH",
      host: "tenant.localhost",
      body: {
        resource: archivedResource.id,
        start: "2026-12-01T09:00:00.000Z",
        end: "2026-12-01T10:00:00.000Z",
      },
    },
  );
  expect(regularResourceChange.status).toBe(403);

  const administratorChange = await request(
    admin,
    `/api/calendar/bookings/${administratorBookingBody.id}`,
    {
      method: "PATCH",
      host: "tenant.localhost",
      body: {
        booked_for_user: adminRecord.id,
        booking_type: null,
        start: "2026-09-01T12:00:00.000Z",
        end: "2026-09-01T13:00:00.000Z",
      },
    },
  );
  expect(administratorChange.status).toBe(200);
  expect(await administratorChange.json()).toMatchObject({
    id: administratorBookingBody.id,
    booked_for_user: adminRecord.id,
    booker_display_name: "Admin A",
    booking_type: null,
    booking_type_name: null,
    start: "2026-09-01 12:00:00.000Z",
  });

  const administratorResourceChange = await request(
    admin,
    `/api/calendar/bookings/${administratorBookingBody.id}`,
    {
      method: "PATCH",
      host: "tenant.localhost",
      body: {
        resource: archivedResource.id,
        start: "2026-09-01T12:00:00.000Z",
        end: "2026-09-01T13:00:00.000Z",
      },
    },
  );
  expect(administratorResourceChange.status).toBe(403);

  const administratorDeletePast = await request(
    admin,
    `/api/calendar/bookings/${administratorBookingBody.id}`,
    { method: "DELETE", host: "tenant.localhost" },
  );
  expect(administratorDeletePast.status).toBe(200);

  const pastBooking = await createBooking(regular, {
    resource: resource.id,
    start: "2026-09-01T14:00:00.000Z",
    end: "2026-09-01T15:00:00.000Z",
  });
  expect(pastBooking.status).toBe(200);
  const pastBookingBody = await pastBooking.json();
  const regularDeletePast = await request(regular, `/api/calendar/bookings/${pastBookingBody.id}`, {
    method: "DELETE",
    host: "tenant.localhost",
  });
  expect(regularDeletePast.status).toBe(400);

  const regularDeleteEligible = await request(
    regular,
    `/api/calendar/bookings/${regularBookingBody.id}`,
    { method: "DELETE", host: "tenant.localhost" },
  );
  expect(regularDeleteEligible.status).toBe(200);

  const rawUpdate = await request(
    regular,
    `/api/collections/bookings/records/${pastBookingBody.id}`,
    {
      method: "PATCH",
      host: "tenant.localhost",
      body: { start: "2026-12-02T14:00:00.000Z", end: "2026-12-02T15:00:00.000Z" },
    },
  );
  expect(rawUpdate.status).toBe(403);

  const rawDelete = await request(
    regular,
    `/api/collections/bookings/records/${pastBookingBody.id}`,
    { method: "DELETE", host: "tenant.localhost" },
  );
  expect(rawDelete.status).toBe(403);

  const archived = await createBooking(regular, {
    resource: archivedResource.id,
    start: "2026-11-30T14:00:00.000Z",
    end: "2026-11-30T15:00:00.000Z",
  });
  expect(archived.status).toBe(400);

  const rawBookings = await request(admin, "/api/collections/bookings/records", {
    host: "tenant.localhost",
  });
  expect(rawBookings.status).toBe(403);

  const rawCreate = await request(regular, "/api/collections/bookings/records", {
    method: "POST",
    host: "tenant.localhost",
    body: {
      resource: resource.id,
      start: "2026-11-30T15:00:00.000Z",
      end: "2026-11-30T16:00:00.000Z",
    },
  });
  expect(rawCreate.status).toBe(403);
});
