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

async function createAuthenticatedClient() {
  const pocketbase = new PocketBase(harness.baseUrl);
  await pocketbase
    .collection("_superusers")
    .authWithPassword(harness.superuser.email, harness.superuser.password);
  return pocketbase;
}

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
  const resources = new Collection({
    id: "fixture_resources",
    name: "resources",
    type: "base",
    fields: [],
  });
  app.save(resources);
  resources.fields.push(
    new RelationField({
      id: "fixture_resource_tenant",
      name: "tenant",
      required: true,
      collectionId: tenants.id,
      cascadeDelete: false,
      maxSelect: 1,
    }),
  );
  resources.fields.push(
    new TextField({
      id: "fixture_resource_name",
      name: "name",
      required: true,
    }),
  );
  resources.fields.push(
    new TextField({
      id: "fixture_resource_name_normalized",
      name: "name_normalized",
      required: false,
    }),
  );
  resources.fields.push(
    new NumberField({
      id: "fixture_resource_base_rate",
      name: "base_rate_minor_units",
      required: false,
      min: -1,
      max: Number.MAX_SAFE_INTEGER,
      noDecimal: false,
    }),
  );
  app.save(resources);
  const seededTenants = app.findRecordsByFilter("tenants", "id != ''", "subdomain", 0, 0);
  const existingResource = new Record(resources);
  existingResource.set("tenant", seededTenants[0].id);
  existingResource.set("name", " Legacy Room A ");
  existingResource.set("name_normalized", "");
  existingResource.set("base_rate_minor_units", 100);
  app.saveNoValidate(existingResource);
  const existingResource2 = new Record(resources);
  existingResource2.set("tenant", seededTenants[0].id);
  existingResource2.set("name", "Legacy Room B");
  existingResource2.set("name_normalized", "");
  existingResource2.set("base_rate_minor_units", 200);
  app.saveNoValidate(existingResource2);
}, () => {});`,
  );
  harness = await startPocketBaseIntegrationHarness({ migrationsDir });
}, 30_000);

afterAll(async () => {
  if (harness) await harness.stop();
  if (migrationsDir) await rm(migrationsDir, { recursive: true, force: true });
});

it("preserves tenant defaults and seeds protected booking types", async () => {
  const pocketbase = await createAuthenticatedClient();
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

it("locks raw collections and reconciles legacy numeric fields before indexing", async () => {
  const pocketbase = await createAuthenticatedClient();
  const collections = await pocketbase.collections.getFullList();
  const resourcesCollection = collections.find((collection) => collection.name === "resources");
  const bookingTypesCollection = await pocketbase.collections.getOne("fixture_booking_types");
  expect(resourcesCollection).toBeDefined();
  expect(resourcesCollection).toMatchObject({
    listRule: null,
    viewRule: null,
    createRule:
      '@request.auth.id != "" && @request.auth.active = true && @request.auth.role = "administrator"',
    updateRule:
      '@request.auth.id != "" && @request.auth.active = true && @request.auth.role = "administrator" && @request.auth.tenant = tenant',
    deleteRule: null,
  });
  expect(bookingTypesCollection).toMatchObject({
    listRule: '@request.auth.id = ""',
    viewRule: '@request.auth.id = ""',
    createRule:
      '@request.auth.id != "" && @request.auth.active = true && @request.auth.role = "administrator"',
    updateRule:
      '@request.auth.id != "" && @request.auth.active = true && @request.auth.role = "administrator" && @request.auth.tenant = tenant',
    deleteRule:
      '@request.auth.id != "" && @request.auth.active = true && @request.auth.role = "administrator" && @request.auth.tenant = tenant',
  });
  expect(
    resourcesCollection!.fields.find((field) => field.name === "base_rate_minor_units"),
  ).toMatchObject({
    required: true,
    min: 0,
    max: Number.MAX_SAFE_INTEGER,
  });
  expect(
    bookingTypesCollection.fields.find((field) => field.name === "surcharge_minor_units"),
  ).toMatchObject({
    required: true,
    min: 0,
    max: Number.MAX_SAFE_INTEGER,
  });
  const seededResources = await pocketbase.collection("resources").getFullList({ sort: "name" });
  expect(
    seededResources
      .filter((resource) => resource.name.includes("Legacy Room"))
      .map((resource) => [resource.name, resource.name_normalized]),
  ).toEqual([
    ["Legacy Room A", "legacy room a"],
    ["Legacy Room B", "legacy room b"],
  ]);
});

it("enforces currency, locale, safe rates, and normalized tenant uniqueness", async () => {
  const pocketbase = await createAuthenticatedClient();
  const [tenant] = await pocketbase.collection("tenants").getFullList({ sort: "subdomain" });
  await expect(
    pocketbase.collection("tenants").update(tenant.id, { currency: "SEK" }),
  ).rejects.toThrow();
  await expect(
    pocketbase.collection("tenants").update(tenant.id, { locale: "not a locale" }),
  ).rejects.toThrow();
  await expect(
    pocketbase.collection("tenants").update(tenant.id, { locale: "en-1" }),
  ).rejects.toThrow();
  await expect(
    pocketbase.collection("tenants").update(tenant.id, { locale: "en-u" }),
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
  await expect(
    pocketbase.collection("resources").create({
      tenant: tenant.id,
      name: "Decimal",
      name_normalized: "decimal",
      base_rate_minor_units: 1.25,
      archived: false,
    }),
  ).rejects.toThrow();
  await expect(
    pocketbase.collection("booking_types").create({
      tenant: tenant.id,
      name: "Custom missing surcharge",
      name_normalized: "custom missing surcharge",
      system_kind: "custom",
      billable: true,
      resource_blocking: true,
      archived: false,
    }),
  ).rejects.toThrow();
  await expect(
    pocketbase.collection("booking_types").create({
      tenant: tenant.id,
      name: "Custom negative surcharge",
      name_normalized: "custom negative surcharge",
      surcharge_minor_units: -1,
      system_kind: "custom",
      billable: true,
      resource_blocking: true,
      archived: false,
    }),
  ).rejects.toThrow();
  await expect(
    pocketbase.collection("booking_types").create({
      tenant: tenant.id,
      name: "Custom decimal surcharge",
      name_normalized: "custom decimal surcharge",
      surcharge_minor_units: 1.25,
      system_kind: "custom",
      billable: true,
      resource_blocking: true,
      archived: false,
    }),
  ).rejects.toThrow();
});
