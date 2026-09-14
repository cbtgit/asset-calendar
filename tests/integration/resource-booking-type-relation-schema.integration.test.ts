// @vitest-environment node
/// <reference types="node" />
import { execFileSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, expect, it } from "vite-plus/test";
import { ensurePocketBaseBinary, resolveRuntimePaths } from "../../scripts/pocketbase.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const productionMigrations = resolve(root, "pb_migrations");
const migrationPath = resolve(
  productionMigrations,
  "1710000006_f05_t01_resource_booking_type_schema.js",
);
let migrationsDir: string | undefined;
let dataDir: string | undefined;
let startupError: unknown;

beforeAll(async () => {
  migrationsDir = await mkdtemp(resolve(tmpdir(), "asset-calendar-f05-relation-mismatch-"));
  await cp(productionMigrations, migrationsDir, { recursive: true });
  await writeFile(
    resolve(migrationsDir, "1710000005_z_f05_relation_mismatch_fixture.js"),
    `migrate((app) => {
  const wrongTarget = app.findCollectionByNameOrId("organizational_units");
  const resources = new Collection({
    id: "fixture_resources_relation_mismatch",
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
      collectionId: wrongTarget.id,
      cascadeDelete: false,
      maxSelect: 1,
    }),
  );
  app.save(resources);
}, () => {});`,
  );
  try {
    const dataDirPath = await mkdtemp(resolve(tmpdir(), "asset-calendar-f05-relation-data-"));
    dataDir = dataDirPath;
    const paths = { ...resolveRuntimePaths(root), dataDir: dataDirPath };
    const binaryPath = await ensurePocketBaseBinary(paths);
    execFileSync(
      binaryPath,
      ["migrate", "up", `--dir=${paths.dataDir}`, `--migrationsDir=${migrationsDir}`],
      { cwd: paths.worktreeRoot, stdio: "pipe" },
    );
  } catch (error) {
    startupError = error;
  }
}, 30_000);

afterAll(async () => {
  if (migrationsDir) await rm(migrationsDir, { recursive: true, force: true });
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});

it("fails migration when a reused relation targets the wrong collection", async () => {
  expect(startupError).toBeInstanceOf(Error);
  const stderr = (startupError as { stderr?: Buffer | string }).stderr;
  const failureText = `${(startupError as Error).message}\n${
    typeof stderr === "string" ? stderr : (stderr?.toString("utf8") ?? "")
  }`;
  expect(failureText).toContain("targets the wrong collection");
  expect(await readFile(migrationPath, "utf8")).toContain(
    "existing.collectionId !== definition.collectionId",
  );
});
