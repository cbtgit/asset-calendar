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

it("applies the tenant and auth schema without seeded records", async () => {
  const pocketbase = new PocketBase(harness.baseUrl);
  const tenant = await pocketbase.collection("tenants").create({
    name: "Example tenant",
    subdomain: "example",
  });
  const organizationalUnit = await pocketbase.collection("organizational_units").create({
    tenant: tenant.id,
    name: "Example unit",
  });
  const user = await pocketbase.collection("users").create({
    tenant: tenant.id,
    first_name: "First",
    last_name: "Administrator",
    email: "admin@example.test",
    password: "Correct horse battery staple!",
    passwordConfirm: "Correct horse battery staple!",
    role: "administrator",
    active: true,
    organizational_unit: organizationalUnit.id,
    password_setup_pending: false,
  });

  expect(user.id).toMatch(/^[a-z0-9]{15}$/);
  expect(user.first_name).toBe("First");
  expect(user.last_name).toBe("Administrator");
  expect(user.role).toBe("administrator");
  expect(user.active).toBe(true);
  expect(user.tenant).toBe(tenant.id);
  expect(user.organizational_unit).toBe(organizationalUnit.id);
  expect(user.password_setup_pending).toBe(false);

  await expect(
    pocketbase.collection("tenants").create({
      name: "Duplicate subdomain",
      subdomain: "example",
    }),
  ).rejects.toThrow();
  await expect(
    pocketbase.collection("users").create({
      tenant: tenant.id,
      email: "admin@example.test",
      password: "Correct horse battery staple!",
      passwordConfirm: "Correct horse battery staple!",
      role: "regular",
      active: true,
      organizational_unit: organizationalUnit.id,
      password_setup_pending: false,
    }),
  ).rejects.toThrow();
  await expect(
    pocketbase.collection("users").create({
      tenant: tenant.id,
      email: "invalid-role@example.test",
      password: "Correct horse battery staple!",
      passwordConfirm: "Correct horse battery staple!",
      role: "owner",
      active: true,
      organizational_unit: organizationalUnit.id,
      password_setup_pending: false,
    }),
  ).rejects.toThrow();
});
