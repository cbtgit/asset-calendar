const AUTH_ENVIRONMENT_VALUES = ["local", "test", "production"];
const MAIL_TRANSPORT_VALUES = ["capture", "test", "smtp2go"];
const INVITATION_LIFETIME_HOURS = 30 * 24;
const SESSION_LIFETIME_HOURS = 24;

const CONFIGURATION_KEYS = [
  "ASSET_CALENDAR_ENV",
  "ASSET_CALENDAR_ROOT_DOMAIN",
  "ASSET_CALENDAR_TENANT_HOSTS",
  "ASSET_CALENDAR_POCKETBASE_URL",
  "ASSET_CALENDAR_INVITATION_URL",
  "ASSET_CALENDAR_INVITATION_LIFETIME_HOURS",
  "ASSET_CALENDAR_SESSION_LIFETIME_HOURS",
  "ASSET_CALENDAR_MAIL_TRANSPORT",
  "ASSET_CALENDAR_SMTP2GO_HOST",
  "ASSET_CALENDAR_SMTP2GO_PORT",
  "ASSET_CALENDAR_SMTP2GO_USERNAME",
  "ASSET_CALENDAR_SMTP2GO_PASSWORD",
  "ASSET_CALENDAR_SMTP2GO_FROM",
];

function required(env, name) {
  const value = env[name];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Authentication configuration requires ${name}.`);
  }
  return value.trim();
}

function parseHost(value, name) {
  if (
    !value ||
    value.length > 253 ||
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i.test(
      value,
    )
  ) {
    throw new Error(`${name} must be a hostname without a scheme, path, port, or credentials.`);
  }
  return value.toLowerCase();
}

function parseHosts(value) {
  const values = value.split(",").map((host) => host.trim());
  if (values.some((host) => host === "")) {
    throw new Error("ASSET_CALENDAR_TENANT_HOSTS must not contain empty entries.");
  }

  const hosts = values.map((host) => parseHost(host, "ASSET_CALENDAR_TENANT_HOSTS"));
  if (new Set(hosts).size !== hosts.length) {
    throw new Error("ASSET_CALENDAR_TENANT_HOSTS must not contain duplicate hosts.");
  }
  return hosts;
}

function parseUrl(value, name) {
  const match = /^(https?):\/\/([^/?#]+)(\/[^?#]*)?(?:\?[^#]*)?$/.exec(value);
  if (!match || /[\s@]/.test(match[2])) {
    throw new Error(`${name} must be an absolute HTTP(S) URL.`);
  }
  const authority = match[2];
  const host = authority.replace(/:\d+$/, "");
  const port = authority.slice(host.length);
  parseHost(host, name);
  if (port && parsePort(port.slice(1), name) < 1) {
    throw new Error(`${name} must be an absolute HTTP(S) URL.`);
  }
  return value.replace(/\/$/, "");
}

function parseInteger(value, name) {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} must be a positive integer.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function parsePort(value, name) {
  const port = parseInteger(value, name);
  if (port > 65535) {
    throw new Error(`${name} must be an integer from 1 to 65535.`);
  }
  return port;
}

function parseMailConfiguration(env, environment, transport) {
  if (environment !== "production") {
    if (transport !== "capture" && transport !== "test") {
      throw new Error(
        `${transport === "smtp2go" ? "ASSET_CALENDAR_MAIL_TRANSPORT" : "ASSET_CALENDAR_ENV"} does not allow SMTP2GO outside production.`,
      );
    }
    return undefined;
  }

  if (transport !== "smtp2go") {
    throw new Error("Production requires ASSET_CALENDAR_MAIL_TRANSPORT=smtp2go.");
  }

  return {
    host: required(env, "ASSET_CALENDAR_SMTP2GO_HOST"),
    port: parsePort(required(env, "ASSET_CALENDAR_SMTP2GO_PORT"), "ASSET_CALENDAR_SMTP2GO_PORT"),
    username: required(env, "ASSET_CALENDAR_SMTP2GO_USERNAME"),
    password: required(env, "ASSET_CALENDAR_SMTP2GO_PASSWORD"),
    from: required(env, "ASSET_CALENDAR_SMTP2GO_FROM"),
  };
}

function validateAuthConfig(env) {
  const environment = required(env, "ASSET_CALENDAR_ENV");
  if (!AUTH_ENVIRONMENT_VALUES.includes(environment)) {
    throw new Error(`ASSET_CALENDAR_ENV must be one of: ${AUTH_ENVIRONMENT_VALUES.join(", ")}.`);
  }

  const transport = required(env, "ASSET_CALENDAR_MAIL_TRANSPORT");
  if (!MAIL_TRANSPORT_VALUES.includes(transport)) {
    throw new Error(
      `ASSET_CALENDAR_MAIL_TRANSPORT must be one of: ${MAIL_TRANSPORT_VALUES.join(", ")}.`,
    );
  }

  const invitationLifetimeHours = parseInteger(
    required(env, "ASSET_CALENDAR_INVITATION_LIFETIME_HOURS"),
    "ASSET_CALENDAR_INVITATION_LIFETIME_HOURS",
  );
  if (invitationLifetimeHours !== INVITATION_LIFETIME_HOURS) {
    throw new Error("ASSET_CALENDAR_INVITATION_LIFETIME_HOURS must be 720 (30 days).");
  }

  const sessionLifetimeHours = parseInteger(
    required(env, "ASSET_CALENDAR_SESSION_LIFETIME_HOURS"),
    "ASSET_CALENDAR_SESSION_LIFETIME_HOURS",
  );
  if (sessionLifetimeHours !== SESSION_LIFETIME_HOURS) {
    throw new Error("ASSET_CALENDAR_SESSION_LIFETIME_HOURS must be 24 (one workday).");
  }

  return {
    environment,
    rootDomain: parseHost(
      required(env, "ASSET_CALENDAR_ROOT_DOMAIN"),
      "ASSET_CALENDAR_ROOT_DOMAIN",
    ),
    tenantHosts: parseHosts(required(env, "ASSET_CALENDAR_TENANT_HOSTS")),
    pocketbaseUrl: parseUrl(
      required(env, "ASSET_CALENDAR_POCKETBASE_URL"),
      "ASSET_CALENDAR_POCKETBASE_URL",
    ),
    invitationUrl: parseUrl(
      required(env, "ASSET_CALENDAR_INVITATION_URL"),
      "ASSET_CALENDAR_INVITATION_URL",
    ),
    invitationLifetimeHours,
    sessionLifetimeHours,
    mailTransport: transport,
    smtp2go: parseMailConfiguration(env, environment, transport),
  };
}

function readEnvironment(getenv) {
  const environment = {};
  for (const key of CONFIGURATION_KEYS) {
    environment[key] = getenv(key);
  }
  return environment;
}

function readPocketBaseEnvironment() {
  return readEnvironment((key) => $os.getenv(key));
}

module.exports = {
  CONFIGURATION_KEYS,
  INVITATION_LIFETIME_HOURS,
  SESSION_LIFETIME_HOURS,
  readEnvironment,
  readPocketBaseEnvironment,
  validateAuthConfig,
};
