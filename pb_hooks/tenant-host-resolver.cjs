/**
 * @typedef {"allow" | "forbid"} HostPortPolicy
 * @typedef {{
 *   rootDomain: string;
 *   tenantHosts: string[];
 *   environment?: "local" | "test" | "production";
 *   hostPortPolicy?: HostPortPolicy;
 *   trustedProxyIps?: string[];
 * }} TenantHostConfiguration
 * @typedef {{
 *   host?: string;
 *   remoteAddress?: string;
 *   headers?: Headers | Map<string, string> | Record<string, string>;
 *   clientTenantId?: unknown;
 * }} TenantRequest
 * @typedef {{ id: string; subdomain: string }} TenantRecord
 * @typedef {{ kind: "resolved"; host: string; tenant: TenantRecord }} ResolvedTenantContext
 * @typedef {{ kind: "unknown" }} UnknownTenantContext
 * @typedef {ResolvedTenantContext | UnknownTenantContext} TenantContext
 */

function unknownTenant() {
  return { kind: "unknown" };
}

function headerValue(headers, name) {
  if (!headers) return undefined;
  if (typeof headers.entries === "function") {
    for (const [key, value] of headers.entries()) {
      if (typeof key === "string" && key.toLowerCase() === name) {
        return typeof value === "string" ? value : undefined;
      }
    }
  }
  if (typeof headers.get === "function") {
    const value = headers.get(name);
    return typeof value === "string" ? value : undefined;
  }
  if (typeof headers === "function") return headerValue(headers(), name);
  if (typeof headers === "object") {
    const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name);
    const value = key ? headers[key] : undefined;
    return typeof value === "string" ? value : undefined;
  }
  return undefined;
}

function requestHeader(request, name) {
  const headers = request?.headers;
  const value = headerValue(headers, name);
  if (value !== undefined) return value;
  if (typeof request?.requestInfo === "function") {
    const infoValue = headerValue(request.requestInfo()?.headers, name);
    if (infoValue !== undefined) return infoValue;
  }
  return headerValue(request?.request?.headers, name);
}

function requestRemoteAddress(request) {
  if (typeof request?.remoteAddress === "string") return request.remoteAddress;
  if (typeof request?.remoteIP === "string") return request.remoteIP;
  if (typeof request?.remoteIP === "function") return request.remoteIP();
  if (typeof request?.requestInfo === "function") return request.requestInfo()?.remoteIP;
  return request?.request?.remoteAddress;
}

function isTrustedProxy(request, trustedProxyIps) {
  if (!Array.isArray(trustedProxyIps) || trustedProxyIps.length === 0) return false;
  const remoteAddress = requestRemoteAddress(request)?.trim().toLowerCase();
  return Boolean(remoteAddress && trustedProxyIps.includes(remoteAddress));
}

function normalizeHost(value, options = {}) {
  if (typeof value !== "string") return undefined;
  const input = value.trim().toLowerCase();
  if (!input || /[\s,/@#?]/.test(input)) return undefined;

  const match = /^([^:]+)(?::(\d+))?$/.exec(input);
  if (!match) return undefined;
  let hostname = match[1];
  const port = match[2];
  if (hostname.endsWith(".")) hostname = hostname.slice(0, -1);
  if (
    !hostname ||
    hostname.length > 253 ||
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/.test(
      hostname,
    )
  ) {
    return undefined;
  }
  if (port !== undefined) {
    if (!options.allowPort) return undefined;
    const portNumber = Number(port);
    if (!Number.isSafeInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
      return undefined;
    }
  }
  return hostname;
}

function extractTenantSubdomain(host, rootDomain) {
  if (host === rootDomain) return undefined;
  const suffix = `.${rootDomain}`;
  if (!host.endsWith(suffix)) return undefined;
  const subdomain = host.slice(0, -suffix.length);
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain) ? subdomain : undefined;
}

function requestHost(request, configuration) {
  const allowPort =
    configuration.hostPortPolicy === "allow" || configuration.environment !== "production";
  const directHost = request?.host ?? requestHeader(request, "host");
  const forwardedHost = requestHeader(request, "x-forwarded-host");
  const hostValue = isTrustedProxy(request, configuration.trustedProxyIps)
    ? (forwardedHost ?? directHost)
    : directHost;
  return normalizeHost(hostValue, { allowPort });
}

/**
 * Resolve a tenant using only the trusted request host.
 *
 * @param {TenantRequest} request
 * @param {TenantHostConfiguration} configuration
 * @param {(input: { host: string; subdomain: string }) => Promise<TenantRecord | null> | TenantRecord | null} findTenant
 * @returns {Promise<TenantContext>}
 */
async function resolveTenantContext(request, configuration, findTenant) {
  const allowPort =
    configuration.hostPortPolicy === "allow" || configuration.environment !== "production";
  const rootDomain = normalizeHost(configuration.rootDomain, { allowPort: false });
  const host = requestHost(request, configuration);
  if (!rootDomain || !host) return unknownTenant();

  const subdomain = extractTenantSubdomain(host, rootDomain);
  const allowedHosts = Array.isArray(configuration.tenantHosts)
    ? configuration.tenantHosts
        .map((tenantHost) => normalizeHost(tenantHost, { allowPort }))
        .filter(Boolean)
    : [];
  if (!subdomain || !allowedHosts.includes(host)) return unknownTenant();

  let record;
  try {
    record = await findTenant({ host, subdomain });
  } catch {
    return unknownTenant();
  }
  if (
    !record ||
    typeof record.id !== "string" ||
    typeof record.subdomain !== "string" ||
    record.subdomain.toLowerCase() !== subdomain
  ) {
    return unknownTenant();
  }

  return {
    kind: "resolved",
    host,
    tenant: { id: record.id, subdomain },
  };
}

function resolveTenantContextSync(request, configuration, findTenant) {
  const allowPort =
    configuration.hostPortPolicy === "allow" || configuration.environment !== "production";
  const rootDomain = normalizeHost(configuration.rootDomain, { allowPort: false });
  const host = requestHost(request, configuration);
  if (!rootDomain || !host) return unknownTenant();

  const subdomain = extractTenantSubdomain(host, rootDomain);
  const allowedHosts = Array.isArray(configuration.tenantHosts)
    ? configuration.tenantHosts
        .map((tenantHost) => normalizeHost(tenantHost, { allowPort }))
        .filter(Boolean)
    : [];
  if (!subdomain || !allowedHosts.includes(host)) return unknownTenant();

  let record;
  try {
    record = findTenant({ host, subdomain });
  } catch {
    return unknownTenant();
  }
  if (
    !record ||
    typeof record.then === "function" ||
    typeof record.id !== "string" ||
    typeof record.subdomain !== "string" ||
    record.subdomain.toLowerCase() !== subdomain
  ) {
    return unknownTenant();
  }

  return {
    kind: "resolved",
    host,
    tenant: { id: record.id, subdomain },
  };
}

module.exports = {
  extractTenantSubdomain,
  normalizeHost,
  resolveTenantHost: resolveTenantContext,
  resolveTenantContext,
  resolveTenantContextSync,
};
