const authConfig = require(`${__hooks}/auth-config.cjs`);
const tenantResolver = require(`${__hooks}/tenant-host-resolver.cjs`);

const configuration = authConfig.validateAuthConfig(authConfig.readPocketBaseEnvironment());
const TENANT_FIELD = "tenant";
const USER_COLLECTION = "users";
const PROTECTED_USER_FIELDS = [
  "tenant",
  "role",
  "active",
  "organizational_unit",
  "password_setup_pending",
];

function deny() {
  throw new ForbiddenError("authorization_failed");
}

function requestInfo(event) {
  const info = event.requestInfo();
  if (!info) deny();
  return info;
}

function isSuperuser(event) {
  return event.hasSuperuserAuth();
}

function authRecord(event) {
  const auth = event.auth ?? event.record;
  if (!auth || auth.collection().type !== "auth") deny();
  if (auth.get("active") !== true) deny();
  return auth;
}

function resolveTenant(info, event) {
  return tenantResolver.resolveTenantContextSync(
    { host: info.headers.host ?? event.requestEvent.request.host, requestInfo: () => info },
    configuration,
    ({ subdomain }) => {
      try {
        const record = $app.findFirstRecordByData("tenants", "subdomain", subdomain);
        return { id: record.id, subdomain: record.get("subdomain") };
      } catch {
        return null;
      }
    },
  );
}

function applicationContext(event) {
  if (isSuperuser(event)) return null;
  if (!isTenantScopedCollection(event)) return null;

  const info = requestInfo(event);
  const auth = authRecord(event);
  const context = resolveTenant(info, event);
  if (context.kind !== "resolved" || auth.get(TENANT_FIELD) !== context.tenant.id) deny();

  return { auth, context, info };
}

function collectionName(event) {
  return event.collection?.name ?? event.record?.collection()?.name;
}

function isTenantScopedCollection(event) {
  const name = collectionName(event);
  if (name === "tenants") return true;

  const collection = event.collection ?? event.record?.collection();
  return Boolean(collection?.fields?.find((field) => field.name === TENANT_FIELD));
}

function recordTenant(record) {
  if (!record || !record.collection().fields.find((field) => field.name === TENANT_FIELD)) {
    return undefined;
  }
  return record.get(TENANT_FIELD);
}

function ensureRecordTenant(record, tenantId) {
  const tenant = recordTenant(record);
  if (tenant !== undefined && tenant !== tenantId) deny();
}

function ensureOrganizationalUnitTenant(value, tenantId) {
  if (!value) return;
  try {
    const unit = $app.findRecordById("organizational_units", value);
    if (unit.get(TENANT_FIELD) !== tenantId) deny();
  } catch {
    deny();
  }
}

function applyServerTenant(info, record, tenantId) {
  if (recordTenant(record) !== undefined) {
    info.body[TENANT_FIELD] = tenantId;
    record.set(TENANT_FIELD, tenantId);
  }
}

function protectUserFields(context, record) {
  if (
    collectionName({ record }) !== USER_COLLECTION ||
    context.auth.get("role") === "administrator"
  ) {
    return;
  }

  for (const field of PROTECTED_USER_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(context.info.body, field)) {
      deny();
    }
  }
}

function checkRecords(event) {
  const context = applicationContext(event);
  if (!context) return event.next();

  const records = event.records ?? [event.record];
  for (const record of records) {
    ensureRecordTenant(record, context.context.tenant.id);
  }
  return event.next();
}

function createRecord(event) {
  const context = applicationContext(event);
  if (!context) return event.next();

  applyServerTenant(context.info, event.record, context.context.tenant.id);
  ensureOrganizationalUnitTenant(context.info.body.organizational_unit, context.context.tenant.id);
  return event.next();
}

function updateRecord(event) {
  const context = applicationContext(event);
  if (!context) return event.next();

  ensureRecordTenant(event.record, context.context.tenant.id);
  protectUserFields(context, event.record);
  applyServerTenant(context.info, event.record, context.context.tenant.id);
  ensureOrganizationalUnitTenant(context.info.body.organizational_unit, context.context.tenant.id);
  return event.next();
}

function rejectInactive(event) {
  if (!event.record || event.record.collection().name !== USER_COLLECTION) {
    return event.next();
  }
  const record = event.record;
  if (record.get("active") !== true || record.get("password_setup_pending") === true) deny();
  const info = requestInfo(event);
  const context = resolveTenant(info, event);
  if (context.kind !== "resolved" || record.get(TENANT_FIELD) !== context.tenant.id) deny();
  return event.next();
}

module.exports = {
  checkRecords,
  createRecord,
  rejectInactive,
  updateRecord,
};
