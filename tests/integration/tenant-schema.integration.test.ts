// @vitest-environment node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import PocketBase from "pocketbase";
import { afterAll, beforeAll, expect, it } from "vite-plus/test";
import {
  startPocketBaseIntegrationHarness,
  type PocketBaseIntegrationHarness,
} from "./pocketbase-harness";

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../pb_migrations");

let harness: PocketBaseIntegrationHarness;

beforeAll(async () => {
  harness = await startPocketBaseIntegrationHarness({ migrationsDir });
});

afterAll(async () => {
  if (harness) await harness.stop();
});

it("requires authenticated access to the tenant and auth schema", async () => {
  const pocketbase = new PocketBase(harness.baseUrl);
  await expect(
    pocketbase.collection("tenants").create({ name: "Example", subdomain: "example" }),
  ).rejects.toThrow("Only superusers can perform this action.");
  await expect(
    pocketbase.collection("organizational_units").create({ tenant: "foreign", name: "Example" }),
  ).rejects.toThrow();
  await expect(
    pocketbase.collection("users").create({
      tenant: "foreign",
      email: "admin@example.test",
      password: "Correct horse battery staple!",
      passwordConfirm: "Correct horse battery staple!",
      role: "administrator",
      active: true,
      organizational_unit: "foreign",
      password_setup_pending: false,
    }),
  ).rejects.toThrow();

  expect(pocketbase.authStore.isValid).toBe(false);
});
