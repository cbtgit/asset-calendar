// @vitest-environment node
import { createRequire } from "node:module";
import { expect, it } from "vite-plus/test";

type TenantRecord = { id: string; subdomain: string };
type TenantContext = { kind: "resolved"; host: string; tenant: TenantRecord } | { kind: "unknown" };
type Resolver = {
  normalizeHost: (value: unknown, options?: { allowPort?: boolean }) => string | undefined;
  resolveTenantContext: (
    request: {
      host?: string;
      remoteAddress?: string;
      headers?: Record<string, string>;
      clientTenantId?: unknown;
    },
    configuration: {
      rootDomain: string;
      tenantHosts: string[];
      environment?: "local" | "test" | "production";
      hostPortPolicy?: "allow" | "forbid";
      trustedProxyIps?: string[];
    },
    findTenant: (input: {
      host: string;
      subdomain: string;
    }) => TenantRecord | null | Promise<TenantRecord | null>,
  ) => Promise<TenantContext>;
};

const resolver = createRequire(import.meta.url)("../pb_hooks/tenant-host-resolver.cjs") as Resolver;

const localConfiguration = {
  rootDomain: "localhost",
  tenantHosts: ["tenant.localhost"],
  environment: "local" as const,
  hostPortPolicy: "allow" as const,
};

const productionConfiguration = {
  rootDomain: "frontend-freelance.dk",
  tenantHosts: ["nejsumlab.frontend-freelance.dk"],
  environment: "production" as const,
  hostPortPolicy: "forbid" as const,
};

const existingTenant = (input: { host: string; subdomain: string }): TenantRecord | null =>
  input.subdomain === "nejsumlab" || input.subdomain === "tenant"
    ? { id: `${input.subdomain}-id`, subdomain: input.subdomain }
    : null;

it("normalizes case, an optional trailing dot, and local ports", () => {
  expect(resolver.normalizeHost(" Tenant.Localhost.:5173", { allowPort: true })).toBe(
    "tenant.localhost",
  );
  expect(resolver.normalizeHost("tenant.localhost:5173", { allowPort: false })).toBeUndefined();
});

it("resolves the configured production tenant from the host", async () => {
  await expect(
    resolver.resolveTenantContext(
      { headers: { Host: "NEJSUMLAB.FRONTEND-FREELANCE.DK." } },
      productionConfiguration,
      existingTenant,
    ),
  ).resolves.toEqual({
    kind: "resolved",
    host: "nejsumlab.frontend-freelance.dk",
    tenant: { id: "nejsumlab-id", subdomain: "nejsumlab" },
  });
});

it("returns the same generic result for root, unknown, malformed, and out-of-scope hosts", async () => {
  const findTenant = async () => ({ id: "should-not-be-used", subdomain: "tenant" });
  const requests = [
    { headers: { host: "localhost" } },
    { headers: { host: "missing.localhost" } },
    { headers: { host: "tenant.localhost:0" } },
    { headers: { host: "tenant.other.example" } },
  ];

  const results = await Promise.all(
    requests.map((request) =>
      resolver.resolveTenantContext(request, localConfiguration, findTenant),
    ),
  );
  expect(results).toEqual([
    { kind: "unknown" },
    { kind: "unknown" },
    { kind: "unknown" },
    { kind: "unknown" },
  ]);
});

it("does not trust forwarded hosts from an untrusted request", async () => {
  const result = await resolver.resolveTenantContext(
    {
      headers: {
        host: "missing.localhost",
        "x-forwarded-host": "tenant.localhost",
      },
      remoteAddress: "203.0.113.10",
    },
    { ...localConfiguration, trustedProxyIps: ["127.0.0.1"] },
    existingTenant,
  );
  expect(result).toEqual({ kind: "unknown" });
});

it("uses a forwarded host only from a configured trusted proxy and ignores client tenant IDs", async () => {
  const result = await resolver.resolveTenantContext(
    {
      headers: {
        host: "127.0.0.1:8090",
        "x-forwarded-host": "tenant.localhost:5173",
      },
      remoteAddress: "127.0.0.1",
      clientTenantId: "nejsumlab-id",
    },
    { ...localConfiguration, trustedProxyIps: ["127.0.0.1"] },
    existingTenant,
  );
  expect(result).toEqual({
    kind: "resolved",
    host: "tenant.localhost",
    tenant: { id: "tenant-id", subdomain: "tenant" },
  });
});

it("fails closed when the tenant lookup does not match the host subdomain", async () => {
  await expect(
    resolver.resolveTenantContext({ host: "tenant.localhost" }, localConfiguration, () => ({
      id: "other-id",
      subdomain: "other",
    })),
  ).resolves.toEqual({ kind: "unknown" });
});
