export type HostPortPolicy = "allow" | "forbid";

export type TenantHostConfiguration = {
  rootDomain: string;
  tenantHosts: string[];
  environment?: "local" | "test" | "production";
  hostPortPolicy?: HostPortPolicy;
  trustedProxyIps?: string[];
};

export type TenantRequest = {
  host?: string;
  remoteAddress?: string;
  headers?: Headers | Map<string, string> | Record<string, string>;
  clientTenantId?: unknown;
};

export type TenantRecord = {
  id: string;
  subdomain: string;
};

export type TenantContext =
  | { kind: "resolved"; host: string; tenant: TenantRecord }
  | { kind: "unknown" };

export function normalizeHost(
  value: unknown,
  options?: { allowPort?: boolean },
): string | undefined;
export function extractTenantSubdomain(host: string, rootDomain: string): string | undefined;
export function resolveTenantContext(
  request: TenantRequest,
  configuration: TenantHostConfiguration,
  findTenant: (input: {
    host: string;
    subdomain: string;
  }) => TenantRecord | null | Promise<TenantRecord | null>,
): Promise<TenantContext>;
export function resolveTenantContextSync(
  request: TenantRequest,
  configuration: TenantHostConfiguration,
  findTenant: (input: { host: string; subdomain: string }) => TenantRecord | null,
): TenantContext;
export const resolveTenantHost: typeof resolveTenantContext;
