// @vitest-environment node
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, expect, it } from "vite-plus/test";
import { startPocketBaseIntegrationHarness } from "./pocketbase-harness";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const productionMigrations = resolve(root, "pb_migrations");
const migrationPath = resolve(productionMigrations, "1710000005_f04_t01_groups_schema.js");
let migrationsDir: string | undefined;
let startupError: unknown;

const ready = (async () => {
  migrationsDir = await mkdtemp(resolve(tmpdir(), "asset-calendar-groups-conflict-"));
  await cp(productionMigrations, migrationsDir, { recursive: true });
  await writeFile(
    resolve(migrationsDir, "1710000004_z_groups_conflict_fixture.js"),
    `migrate((app) => {
  const tenants = app.findCollectionByNameOrId("tenants");
  const units = app.findCollectionByNameOrId("organizational_units");
  const tenant = new Record(tenants);
  tenant.set("name", "Conflict tenant");
  tenant.set("subdomain", "conflict");
  app.save(tenant);
  for (const name of ["Legacy Group", " legacy group "]) {
    const unit = new Record(units);
    unit.set("tenant", tenant.id);
    unit.set("name", name);
    app.save(unit);
  }
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

it("fails migration explicitly when legacy names collide after normalization", async () => {
  await ready;
  expect(startupError).toBeInstanceOf(Error);
  expect((startupError as Error).message).toMatch(/Command failed:/);
  const migrationSource = await readFile(migrationPath, "utf8");
  expect(migrationSource).toMatch(
    /normalization conflict: tenant \$\{tenant\}, records \$\{conflict\} and \$\{record\.id\} share normalized name/,
  );
  expect(migrationSource).toContain('record.set("name_normalized", normalized)');
  expect(migrationSource).toContain(
    "CREATE UNIQUE INDEX idx_organizational_units_tenant_name_normalized ON organizational_units (tenant, name_normalized)",
  );
  expect(migrationSource).not.toMatch(/name\s*=\s*`\$\{name\} \(\d+\)`/);
});
