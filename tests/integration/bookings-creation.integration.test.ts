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
const scenarioStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
scenarioStart.setUTCMinutes(0, 0, 0);

function scenarioTime(hours = 0, minutes = 0): string {
  const value = new Date(scenarioStart);
  value.setUTCHours(value.getUTCHours() + hours);
  value.setUTCMinutes(value.getUTCMinutes() + minutes);
  return value.toISOString();
}

function pocketBaseDate(value: string): string {
  return value.replace("T", " ");
}

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

  const formulaResourceResponse = await request(admin, "/api/collections/resources/records", {
    method: "POST",
    host: "tenant.localhost",
    body: {
      name: '=HYPERLINK("http://x")',
      base_rate_minor_units: 0,
    },
  });
  expect(formulaResourceResponse.status).toBe(200);
  const formulaResource = await formulaResourceResponse.json();

  const bookingTypeResponse = await request(admin, "/api/collections/booking_types/records", {
    method: "POST",
    host: "tenant.localhost",
    body: {
      tenant: adminRecord.tenant,
      name: "Training",
      surcharge_minor_units: 1250,
      color: "#168C6C",
    },
  });
  expect(bookingTypeResponse.status).toBe(200);
  const bookingType = await bookingTypeResponse.json();

  const nonbillableTypeResponse = await request(admin, "/api/collections/booking_types/records", {
    method: "POST",
    host: "tenant.localhost",
    body: {
      tenant: adminRecord.tenant,
      name: "Maintenance",
      surcharge_minor_units: 9000,
      nonbillable: true,
      color: "#CF7B36",
    },
  });
  expect(nonbillableTypeResponse.status).toBe(200);
  const nonbillableType = await nonbillableTypeResponse.json();
  expect(nonbillableType).toMatchObject({
    name: "Maintenance",
    surcharge_minor_units: 0,
    nonbillable: true,
  });

  const regularBooking = await createBooking(regular, {
    resource: resource.id,
    start: scenarioTime(),
    end: scenarioTime(1),
  });
  expect(regularBooking.status).toBe(200);
  const regularBookingBody = await regularBooking.json();
  expect(regularBookingBody).toMatchObject({
    id: expect.any(String),
    resource: resource.id,
    booker_display_name: "Regular A",
    booking_type_name: null,
    booking_type_color: null,
  });
  expect(regularBookingBody).not.toHaveProperty("tenant");
  expect(regularBookingBody).not.toHaveProperty("resource_base_rate_minor_units");
  expect(regularBookingBody).not.toHaveProperty("effective_rate_minor_units");
  expect(regularBookingBody).not.toHaveProperty("booker_email_snapshot");

  const foreignOwner = await createBooking(regular, {
    resource: resource.id,
    booked_for_user: adminRecord.id,
    start: scenarioTime(1),
    end: scenarioTime(2),
  });
  expect(foreignOwner.status).toBe(403);

  const privilegedType = await createBooking(regular, {
    resource: resource.id,
    booking_type: bookingType.id,
    start: scenarioTime(1),
    end: scenarioTime(2),
  });
  expect(privilegedType.status).toBe(403);

  const invalidAlignment = await createBooking(regular, {
    resource: resource.id,
    start: scenarioTime(1, 5),
    end: scenarioTime(2),
  });
  expect(invalidAlignment.status).toBe(400);

  const adjacentBooking = await createBooking(regular, {
    resource: resource.id,
    start: scenarioTime(1),
    end: scenarioTime(2),
  });
  expect(adjacentBooking.status).toBe(200);

  const overlap = await createBooking(regular, {
    resource: resource.id,
    start: scenarioTime(1, 45),
    end: scenarioTime(2, 45),
  });
  expect(overlap.status).toBe(400);

  const administratorBooking = await createBooking(admin, {
    resource: resource.id,
    booked_for_user: regularRecord.id,
    booking_type: bookingType.id,
    start: scenarioTime(3),
    end: scenarioTime(4),
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

  const nonbillableBooking = await createBooking(admin, {
    resource: resource.id,
    booked_for_user: regularRecord.id,
    booking_type: nonbillableType.id,
    start: scenarioTime(5),
    end: scenarioTime(6),
  });
  expect(nonbillableBooking.status).toBe(200);
  const nonbillableBookingBody = await nonbillableBooking.json();
  expect(nonbillableBookingBody).toMatchObject({
    resource: resource.id,
    booked_for_user: regularRecord.id,
    created_by_user: adminRecord.id,
    booking_type: nonbillableType.id,
    booking_type_name: "Maintenance",
  });

  const formulaBooking = await createBooking(admin, {
    resource: formulaResource.id,
    booked_for_user: regularRecord.id,
    start: scenarioTime(7),
    end: scenarioTime(8),
  });
  expect(formulaBooking.status).toBe(200);

  const privileged = new PocketBase(harness.baseUrl);
  await authenticateSuperuser(privileged);
  const storedBookings = await request(privileged, "/api/collections/bookings/records", {
    host: "tenant.localhost",
  });
  expect(storedBookings.status).toBe(200);
  const storedBookingItems = (await storedBookings.json()).items;
  const storedBooking = storedBookingItems.find(
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
    booking_type_color_snapshot: "",
  });
  const storedNonbillableBooking = storedBookingItems.find(
    (item: { id: string }) => item.id === nonbillableBookingBody.id,
  );
  expect(storedNonbillableBooking).toMatchObject({
    resource_base_rate_minor_units: 0,
    booking_type_surcharge_minor_units: 0,
    effective_rate_minor_units: 0,
    booked_for_user: regularRecord.id,
    created_by_user: adminRecord.id,
  });

  const billingPreview = await request(
    admin,
    "/api/billing/export?start=2026-01-01&end=2027-01-01",
    { host: "tenant.localhost" },
  );
  expect(billingPreview.status).toBe(200);
  const billingPreviewBody = await billingPreview.json();
  expect(billingPreviewBody).toMatchObject({
    groups: [
      expect.objectContaining({
        name: "Unit A",
        total: "57.50",
        records: expect.arrayContaining([
          expect.objectContaining({
            booker: "Regular A",
            group: "Unit A",
            resource: "Room A",
            amount: "15.00",
          }),
          expect.objectContaining({
            booker: "Regular A",
            booking_type: "Training",
            amount: "27.50",
          }),
        ]),
      }),
    ],
    total: "57.50",
  });
  expect(JSON.stringify(billingPreviewBody)).not.toContain("Maintenance");

  const oversizedBookingRange = await request(
    regular,
    `/api/calendar/bookings?resource=${encodeURIComponent(resource.id)}&start=1970-01-01T00:00:00.000Z&end=2999-01-01T00:00:00.000Z`,
    { host: "tenant.localhost" },
  );
  expect(oversizedBookingRange.status).toBe(400);
  expect((await oversizedBookingRange.text()).toLowerCase()).toContain("booking_range_too_large");

  const oversizedBillingInterval = await request(
    admin,
    "/api/billing/export?start=1970-01-01&end=2999-01-01",
    { host: "tenant.localhost" },
  );
  expect(oversizedBillingInterval.status).toBe(400);
  expect((await oversizedBillingInterval.text()).toLowerCase()).toContain(
    "billing_interval_too_large",
  );

  const billingCsv = await request(
    admin,
    "/api/billing/export?start=2026-01-01&end=2027-01-01&format=csv",
    { host: "tenant.localhost" },
  );
  expect(billingCsv.status).toBe(200);
  expect(billingCsv.headers.get("content-type")).toContain("text/csv");
  expect(billingCsv.headers.get("content-disposition")).toContain(
    "billing-2026-01-01-2027-01-01.csv",
  );
  const billingCsvBody = await billingCsv.text();
  expect(billingCsvBody).toContain(
    "start,end,duration_hours,booker,group,resource,booking_type,amount\r\n",
  );
  expect(billingCsvBody).toContain(",Regular A,Unit A,Room A,,15.00\r\n");
  expect(billingCsvBody).toContain('"\'=HYPERLINK(""http://x"")"');
  expect(billingCsvBody).not.toContain("Maintenance");

  const regularBillingPreview = await request(
    regular,
    "/api/billing/export?start=2026-01-01&end=2027-01-01",
    { host: "tenant.localhost" },
  );
  expect(regularBillingPreview.status).toBe(403);

  const regularVisible = await request(
    regular,
    "/api/calendar/bookings?resource=" +
      encodeURIComponent(resource.id) +
      `&start=${encodeURIComponent(scenarioTime(-1))}&end=${encodeURIComponent(scenarioTime(7))}`,
    { host: "tenant.localhost" },
  );
  expect(regularVisible.status).toBe(200);
  const regularVisibleBody = await regularVisible.json();
  expect(regularVisibleBody.items).toHaveLength(4);
  expect(regularVisibleBody.items[0]).toMatchObject({
    resource: resource.id,
    booker_display_name: "Regular A",
    booking_type_name: null,
    booking_type_color: null,
  });
  expect(regularVisibleBody.items[0]).not.toHaveProperty("effective_rate_minor_units");

  const administratorVisible = await request(
    admin,
    "/api/calendar/bookings?resource=" +
      encodeURIComponent(resource.id) +
      `&start=${encodeURIComponent(scenarioTime(-1))}&end=${encodeURIComponent(scenarioTime(7))}`,
    { host: "tenant.localhost" },
  );
  expect(administratorVisible.status).toBe(200);
  expect((await administratorVisible.json()).items).toContainEqual(
    expect.objectContaining({
      booking_type_name: "Training",
      booking_type_color: "#168C6C",
    }),
  );

  const regularUpdate = await request(regular, `/api/calendar/bookings/${regularBookingBody.id}`, {
    method: "PATCH",
    host: "tenant.localhost",
    body: {
      start: scenarioTime(24),
      end: scenarioTime(25),
    },
  });
  expect(regularUpdate.status).toBe(200);
  expect(await regularUpdate.json()).toMatchObject({
    id: regularBookingBody.id,
    start: pocketBaseDate(scenarioTime(24)),
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
        start: scenarioTime(24),
        end: scenarioTime(25),
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
    start: scenarioTime(5),
    end: scenarioTime(6),
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
      start: scenarioTime(6),
      end: scenarioTime(7),
    },
  });
  expect(rawCreate.status).toBe(403);

  const settingsResponse = await request(admin, "/api/collections/tenant_settings/records", {
    host: "tenant.localhost",
  });
  expect(settingsResponse.status).toBe(200);
  const settingsItems = (await settingsResponse.json()).items;
  expect(settingsItems).toHaveLength(1);
  expect(settingsItems[0]).toMatchObject({
    tenant: adminRecord.tenant,
    site_title: "Asset Calendar",
    booking_lock_hours: 24,
  });

  const regularSettingsUpdate = await request(
    regular,
    `/api/collections/tenant_settings/records/${settingsItems[0].id}`,
    {
      method: "PATCH",
      host: "tenant.localhost",
      body: { site_title: "Not allowed", booking_lock_hours: 0 },
    },
  );
  expect(regularSettingsUpdate.status).toBe(404);

  const administratorSettingsUpdate = await request(
    admin,
    `/api/collections/tenant_settings/records/${settingsItems[0].id}`,
    {
      method: "PATCH",
      host: "tenant.localhost",
      body: { site_title: "Workshop", booking_lock_hours: 0 },
    },
  );
  expect(administratorSettingsUpdate.status).toBe(200);
  expect(await administratorSettingsUpdate.json()).toMatchObject({
    site_title: "Workshop",
    booking_lock_hours: 0,
  });

  const unlockedPastBooking = await createBooking(regular, {
    resource: resource.id,
    start: "2026-09-01T16:00:00.000Z",
    end: "2026-09-01T17:00:00.000Z",
  });
  expect(unlockedPastBooking.status).toBe(200);
  const unlockedPastBookingBody = await unlockedPastBooking.json();
  expect(unlockedPastBookingBody).toMatchObject({ can_edit: true, can_delete: true });
  const unlockedDelete = await request(
    regular,
    `/api/calendar/bookings/${unlockedPastBookingBody.id}`,
    { method: "DELETE", host: "tenant.localhost" },
  );
  expect(unlockedDelete.status).toBe(200);
});
