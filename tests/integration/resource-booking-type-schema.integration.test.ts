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
let migrationsDir: string;
let harness: PocketBaseIntegrationHarness;

beforeAll(async () => {
  migrationsDir = await mkdtemp(resolve(tmpdir(), "asset-calendar-f05-schema-"));
  await cp(productionMigrations, migrationsDir, { recursive: true });
  await writeFile(
    resolve(migrationsDir, "1710000005_z_f05_schema_fixture.js"),
    `migrate((app) => {
  const tenants = app.findCollectionByNameOrId("tenants");
  for (const [name, subdomain] of [["Danish tenant", "danish"], ["Euro tenant", "euro"]]) {
    const tenant = new Record(tenants);
    tenant.set("name", name);
    tenant.set("subdomain", subdomain);
    app.save(tenant);
  }
  const bookingTypes = new Collection({
    id: "fixture_booking_types",
    name: "booking_types",
    type: "base",
    fields: [
      new NumberField({
        id: "fixture_booking_type_surcharge",
        name: "surcharge_minor_units",
        required: false,
        min: 0,
        max: Number.MAX_SAFE_INTEGER,
        noDecimal: false,
      }),
    ],
  });
  app.save(bookingTypes);
}, () => {});`,
  );
  harness = await startPocketBaseIntegrationHarness({ migrationsDir });
});

afterAll(async () => {
  if (harness) await harness.stop();
  if (migrationsDir) await rm(migrationsDir, { recursive: true, force: true });
});

it("preserves tenant defaults and seeds protected booking types", async () => {
  const pocketbase = new PocketBase(harness.baseUrl);
  await pocketbase
    .collection("_superusers")
    .authWithPassword(harness.superuser.email, harness.superuser.password);
  const tenants = await pocketbase.collection("tenants").getFullList({ sort: "subdomain" });
  expect(tenants.map((tenant) => [tenant.currency, tenant.locale])).toEqual([
    ["DKK", "da-DK"],
    ["DKK", "da-DK"],
  ]);

  const bookingTypes = await pocketbase.collection("booking_types").getFullList({
    sort: "tenant,system_kind",
  });
  expect(bookingTypes).toHaveLength(6);
  for (const tenant of tenants) {
    const types = bookingTypes.filter((type) => type.tenant === tenant.id);
    expect(types.map((type) => type.system_kind)).toEqual(["maintenance", "regular", "training"]);
    expect(types.find((type) => type.system_kind === "regular")).toMatchObject({
      surcharge_minor_units: 0,
      billable: true,
      resource_blocking: true,
      archived: false,
    });
    expect(types.find((type) => type.system_kind === "maintenance")).toMatchObject({
      surcharge_minor_units: 0,
      billable: false,
      resource_blocking: true,
      archived: false,
    });
  }
});

it("denies raw resource and booking-type collection access", async () => {
  const pocketbase = new PocketBase(harness.baseUrl);
  await expect(pocketbase.collection("resources").getFullList()).rejects.toThrow();
  await expect(pocketbase.collection("booking_types").getFullList()).rejects.toThrow();
});

it("enforces currency, locale, safe rates, and normalized tenant uniqueness", async () => {
  const pocketbase = new PocketBase(harness.baseUrl);
  await pocketbase
    .collection("_superusers")
    .authWithPassword(harness.superuser.email, harness.superuser.password);
  const [tenant] = await pocketbase.collection("tenants").getFullList({ sort: "subdomain" });
  const resourcesCollection = await pocketbase.collections.getOne("f05_resources");
  const bookingTypesCollection = await pocketbase.collections.getOne("fixture_booking_types");
  expect(
    resourcesCollection.fields.find((field) => field.name === "base_rate_minor_units"),
  ).toMatchObject({
    required: true,
  });
  expect(
    bookingTypesCollection.fields.find((field) => field.name === "surcharge_minor_units"),
  ).toMatchObject({
    required: true,
  });
  await expect(
    pocketbase.collection("tenants").update(tenant.id, { currency: "SEK" }),
  ).rejects.toThrow();
  await expect(
    pocketbase.collection("tenants").update(tenant.id, { locale: "not a locale" }),
  ).rejects.toThrow();
  const resource = await pocketbase.collection("resources").create({
    tenant: tenant.id,
    name: "Meeting room",
    name_normalized: "meeting room",
    base_rate_minor_units: 1250,
    archived: false,
  });
  expect(resource.base_rate_minor_units).toBe(1250);
  await expect(
    pocketbase.collection("resources").create({
      tenant: tenant.id,
      name: " meeting room ",
      name_normalized: "meeting room",
      base_rate_minor_units: 0,
      archived: false,
    }),
  ).rejects.toThrow();
  await expect(
    pocketbase.collection("resources").create({
      tenant: tenant.id,
      name: "Missing rate",
      name_normalized: "missing rate",
      archived: false,
    }),
  ).rejects.toThrow();
  await expect(
    pocketbase.collection("resources").create({
      tenant: tenant.id,
      name: "Negative",
      name_normalized: "negative",
      base_rate_minor_units: -1,
      archived: false,
    }),
  ).rejects.toThrow();
});
