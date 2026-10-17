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
let migrationsDir: string | undefined;
let harness: PocketBaseIntegrationHarness | undefined;
let pocketbase: PocketBase;

beforeAll(async () => {
  migrationsDir = await mkdtemp(resolve(tmpdir(), "asset-calendar-groups-conflict-"));
  await cp(productionMigrations, migrationsDir, { recursive: true });
  await writeFile(
    resolve(migrationsDir, "1710000015_z_legacy_groups_fixture.js"),
    `migrate((app) => {
  const tenants = app.findCollectionByNameOrId("tenants");
  const units = app.findCollectionByNameOrId("organizational_units");
  const users = app.findCollectionByNameOrId("users");
  const resources = app.findCollectionByNameOrId("resources");
  const bookings = app.findCollectionByNameOrId("bookings");

  const tenant = new Record(tenants);
  tenant.set("name", "Legacy tenant");
  tenant.set("subdomain", "legacy");
  app.save(tenant);

  const unit = new Record(units);
  unit.set("tenant", tenant.id);
  unit.set("name", "Legacy Group");
  unit.set("name_normalized", "legacy group");
  app.save(unit);

  const admin = new Record(users);
  admin.set("email", "admin@example.test");
  admin.set("email_normalized", "admin@example.test");
  admin.set("password", "Correct horse battery staple!");
  admin.set("passwordConfirm", "Correct horse battery staple!");
  admin.set("tenant", tenant.id);
  admin.set("organizational_unit", unit.id);
  admin.set("first_name", "Ada");
  admin.set("last_name", "Admin");
  admin.set("role", "administrator");
  admin.set("active", true);
  admin.set("password_setup_pending", false);
  app.save(admin);

  const user = new Record(users);
  user.set("email", "user@example.test");
  user.set("email_normalized", "user@example.test");
  user.set("password", "Correct horse battery staple!");
  user.set("passwordConfirm", "Correct horse battery staple!");
  user.set("tenant", tenant.id);
  user.set("organizational_unit", unit.id);
  user.set("first_name", "Grace");
  user.set("last_name", "User");
  user.set("role", "regular");
  user.set("active", true);
  user.set("password_setup_pending", false);
  app.save(user);

  const resource = new Record(resources);
  resource.set("tenant", tenant.id);
  resource.set("name", "Room A");
  resource.set("name_normalized", "room a");
  resource.set("base_rate_minor_units", 1500);
  resource.set("archived_at", "");
  app.save(resource);

  const booking = new Record(bookings);
  booking.set("tenant", tenant.id);
  booking.set("resource", resource.id);
  booking.set("booked_for_user", user.id);
  booking.set("created_by_user", admin.id);
  booking.set("start", "2026-10-20 10:00:00.000Z");
  booking.set("end", "2026-10-20 11:00:00.000Z");
  booking.set("booker_display_name_snapshot", "Grace User");
  booking.set("booker_group_snapshot", "Legacy Group");
  booking.set("booker_email_snapshot", "user@example.test");
  booking.set("resource_name_snapshot", "Room A");
  app.save(booking);
}, () => {});`,
  );
  harness = await startPocketBaseIntegrationHarness({ migrationsDir });
  pocketbase = new PocketBase(harness.baseUrl);
  await pocketbase
    .collection("_superusers")
    .authWithPassword(harness.superuser.email, harness.superuser.password);
}, 60_000);

afterAll(async () => {
  await harness?.stop();
  if (migrationsDir) await rm(migrationsDir, { recursive: true, force: true });
});

it("removes legacy groups while preserving users and bookings", async () => {
  const userCollection = await pocketbase.collections.getOne("users");
  const bookingCollection = await pocketbase.collections.getOne("bookings");
  expect(userCollection.fields.map((field) => field.name)).toContain("account_reference_number");
  expect(userCollection.fields.map((field) => field.name)).not.toContain("organizational_unit");
  expect(bookingCollection.fields.map((field) => field.name)).toContain(
    "account_reference_number_snapshot",
  );
  expect(bookingCollection.fields.map((field) => field.name)).not.toContain(
    "booker_group_snapshot",
  );
  await expect(pocketbase.collections.getOne("organizational_units")).rejects.toMatchObject({
    status: 404,
  });

  const users = await pocketbase.collection("users").getFullList();
  expect(users).toHaveLength(2);
  expect(users.map((user) => user.email)).toContain("user@example.test");
  expect(users[0]).toHaveProperty("account_reference_number", "");

  const bookings = await pocketbase.collection("bookings").getFullList();
  expect(bookings).toHaveLength(1);
  expect(bookings[0]).toMatchObject({
    booker_display_name_snapshot: "Grace User",
    booker_email_snapshot: "user@example.test",
    resource_name_snapshot: "Room A",
    account_reference_number_snapshot: "",
  });
  expect(bookings[0]).not.toHaveProperty("booker_group_snapshot");
});
