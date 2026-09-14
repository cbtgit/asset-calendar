const authConfig = require(`${__hooks}/auth-config.cjs`);
const tenantResolver = require(`${__hooks}/tenant-host-resolver.cjs`);

const configuration = authConfig.validateAuthConfig(authConfig.readPocketBaseEnvironment());
const TENANT_FIELD = "tenant";
const USER_COLLECTION = "users";
const ORGANIZATIONAL_UNIT_COLLECTION = "organizational_units";
const BOOKING_TYPE_COLLECTION = "booking_types";
const RESOURCE_COLLECTION = "resources";
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

function resourceAccess() {
  return require(`${__hooks}/resource-access.cjs`);
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
    {
      host: info.headers.host ?? event.request?.host ?? event.requestEvent?.request?.host,
      requestInfo: () => info,
    },
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

function isAdministrator(context) {
  return context.auth.get("role") === "administrator";
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

function protectTenantSettings(context) {
  if (!isAdministrator(context)) deny();
  for (const field of Object.keys(context.info.body)) {
    if (field !== "locale") deny();
  }
  if (Object.prototype.hasOwnProperty.call(context.info.body, "currency")) {
    deny();
  }
}

function checkRecords(event) {
  const context = applicationContext(event);
  if (!context) return event.next();
  if (collectionName(event) === BOOKING_TYPE_COLLECTION && !isAdministrator(context)) deny();

  if (collectionName(event) === RESOURCE_COLLECTION) deny();

  const records = event.records ?? [event.record];
  for (const record of records) {
    ensureRecordTenant(record, context.context.tenant.id);
  }
  return event.next();
}

function deleteRecord(event) {
  const context = applicationContext(event);
  if (!context) return event.next();
  ensureRecordTenant(event.record, context.context.tenant.id);
  if (collectionName({ record: event.record }) === BOOKING_TYPE_COLLECTION) deny();
  if (collectionName({ record: event.record }) === RESOURCE_COLLECTION) deny();
  if (collectionName({ record: event.record }) === ORGANIZATIONAL_UNIT_COLLECTION) {
    groupAccess.guardOrganizationalUnitDelete(event.record);
  }
  return event.next();
}

function createRecord(event) {
  const context = applicationContext(event);
  if (!context) return event.next();

  const collection = collectionName({ record: event.record });
  if (collection === RESOURCE_COLLECTION && context.auth.get("role") !== "administrator") deny();
  if (collection === ORGANIZATIONAL_UNIT_COLLECTION) {
    groupAccess.normalizeOrganizationalUnit(
      event,
      context.info,
      event.record,
      context.context.tenant.id,
    );
  } else if (collectionName({ record: event.record }) === BOOKING_TYPE_COLLECTION) {
    if (!isAdministrator(context)) deny();
    bookingTypeAccess.normalizeBookingType(event, {
      info: context.info,
      record: event.record,
      tenantId: context.context.tenant.id,
      isCreate: true,
    });
  } else if (collection === RESOURCE_COLLECTION) {
    resourceAccess().normalizeResource(
      event,
      context.info,
      event.record,
      context.context.tenant.id,
      true,
    );
  } else {
    applyServerTenant(context.info, event.record, context.context.tenant.id);
  }
  ensureOrganizationalUnitTenant(context.info.body.organizational_unit, context.context.tenant.id);
  return event.next();
}

function updateRecord(event) {
  const context = applicationContext(event);
  if (!context) return event.next();

  ensureRecordTenant(event.record, context.context.tenant.id);
  protectUserFields(context, event.record);
  const collection = collectionName({ record: event.record });
  if (collection === "tenants") protectTenantSettings(context);
  if (collection === RESOURCE_COLLECTION && context.auth.get("role") !== "administrator") deny();
  if (collection === ORGANIZATIONAL_UNIT_COLLECTION) {
    groupAccess.normalizeOrganizationalUnit(
      event,
      context.info,
      event.record,
      context.context.tenant.id,
    );
  } else if (collectionName({ record: event.record }) === BOOKING_TYPE_COLLECTION) {
    if (!isAdministrator(context)) deny();
    bookingTypeAccess.normalizeBookingType(event, {
      info: context.info,
      record: event.record,
      tenantId: context.context.tenant.id,
      isCreate: false,
    });
  } else if (collection === RESOURCE_COLLECTION) {
    resourceAccess().normalizeResource(
      event,
      context.info,
      event.record,
      context.context.tenant.id,
      false,
    );
  } else {
    applyServerTenant(context.info, event.record, context.context.tenant.id);
  }
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

const bookingTypeAccess = require(`${__hooks}/booking-type-access.cjs`).createBookingTypeAccess({
  applicationContext,
  deny,
  isAdministrator,
});
const groupAccess = require(`${__hooks}/group-access.cjs`).createGroupAccess({
  applicationContext,
  deny,
});

module.exports = {
  checkRecords,
  createRecord,
  deleteRecord,
  applicationContext,
  deny,
  groupsProjectionRoute: groupAccess.groupsProjectionRoute,
  bookingTypesProjectionRoute: bookingTypeAccess.bookingTypesProjectionRoute,
  bookingTypesSelectionProjectionRoute: (event) =>
    bookingTypeAccess.bookingTypesProjectionRoute(event, true),
  rejectInactive,
  updateRecord,
};
