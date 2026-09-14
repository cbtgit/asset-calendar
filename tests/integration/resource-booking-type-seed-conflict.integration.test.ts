// @vitest-environment node
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, expect, it } from "vite-plus/test";
import { startPocketBaseIntegrationHarness } from "./pocketbase-harness";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const productionMigrations = resolve(root, "pb_migrations");
const migrationPath = resolve(
  productionMigrations,
  "1710000006_f05_t01_resource_booking_type_schema.js",
);
let migrationsDir: string | undefined;
let startupError: unknown;

const ready = (async () => {
  migrationsDir = await mkdtemp(resolve(tmpdir(), "asset-calendar-f05-seed-conflict-"));
  await cp(productionMigrations, migrationsDir, { recursive: true });
  await writeFile(
    resolve(migrationsDir, "1710000005_z_f05_seed_conflict_fixture.js"),
    `migrate((app) => {
  const tenants = app.findCollectionByNameOrId("tenants");
  const tenant = new Record(tenants);
  tenant.set("name", "Conflict tenant");
  tenant.set("subdomain", "seed-conflict");
  app.save(tenant);
  const bookingTypes = new Collection({
    id: "fixture_booking_types_conflict",
    name: "booking_types",
    type: "base",
    fields: [],
  });
  app.save(bookingTypes);
  bookingTypes.fields.push(
    new RelationField({
      id: "fixture_booking_type_tenant",
      name: "tenant",
      required: true,
      collectionId: tenants.id,
      cascadeDelete: false,
      maxSelect: 1,
    }),
  );
  bookingTypes.fields.push(
    new TextField({
      id: "fixture_booking_type_name",
      name: "name",
      required: true,
    }),
  );
  bookingTypes.fields.push(
    new TextField({
      id: "fixture_booking_type_name_normalized",
      name: "name_normalized",
      required: false,
    }),
  );
  bookingTypes.fields.push(
    new NumberField({
      id: "fixture_booking_type_surcharge",
      name: "surcharge_minor_units",
      required: false,
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
      noDecimal: false,
    }),
  );
  bookingTypes.fields.push(
    new SelectField({
      id: "fixture_booking_type_system_kind",
      name: "system_kind",
      required: true,
      maxSelect: 1,
      values: ["regular", "training", "maintenance", "custom"],
    }),
  );
  bookingTypes.fields.push(
    new BoolField({ id: "fixture_booking_type_billable", name: "billable", required: false }),
  );
  bookingTypes.fields.push(
    new BoolField({
      id: "fixture_booking_type_resource_blocking",
      name: "resource_blocking",
      required: false,
    }),
  );
  bookingTypes.fields.push(
    new BoolField({ id: "fixture_booking_type_archived", name: "archived", required: false }),
  );
  app.save(bookingTypes);
  const legacy = new Record(bookingTypes);
  legacy.set("tenant", tenant.id);
  legacy.set("name", " Regular ");
  legacy.set("name_normalized", " regular ");
  legacy.set("surcharge_minor_units", "1");
  legacy.set("system_kind", "custom");
  legacy.set("billable", true);
  legacy.set("resource_blocking", true);
  legacy.set("archived", false);
  app.save(legacy);
}, () => {});`,
  );
  try {
    const harness = await startPocketBaseIntegrationHarness({ migrationsDir });
    await harness.stop();
  } catch (error) {
    startupError = error;
  }
})();

afterAll(async () => {
  await ready;
  if (migrationsDir) await rm(migrationsDir, { recursive: true, force: true });
});

it("fails migration explicitly when a seeded booking-type name is already taken", async () => {
  await ready;
  expect(startupError).toBeInstanceOf(Error);
  expect((startupError as Error).message).toMatch(/Command failed:/);
  const migrationSource = await readFile(migrationPath, "utf8");
  expect(migrationSource).toContain("Booking type seed conflict:");
  expect(migrationSource).toContain('record.get("name_normalized") === normalizedName');
  expect(
    migrationSource.indexOf("for (const tenant of records(app, tenants)) seedBookingTypes"),
  ).toBeLessThan(
    migrationSource.indexOf(
      "CREATE UNIQUE INDEX idx_booking_types_tenant_name_normalized ON booking_types (tenant, name_normalized)",
    ),
  );
});
