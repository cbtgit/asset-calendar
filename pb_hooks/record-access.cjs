const authConfig = require(`${__hooks}/auth-config.cjs`);
const tenantResolver = require(`${__hooks}/tenant-host-resolver.cjs`);

const configuration = authConfig.validateAuthConfig(authConfig.readPocketBaseEnvironment());
const TENANT_FIELD = "tenant";
const USER_COLLECTION = "users";
const ORGANIZATIONAL_UNIT_COLLECTION = "organizational_units";
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

function applyServerTenant(info, record, tenantId) {
  if (recordTenant(record) !== undefined) {
    info.body[TENANT_FIELD] = tenantId;
    record.set(TENANT_FIELD, tenantId);
  }
}

function normalizeOrganizationalUnit(info, record, tenantId) {
  if (Object.prototype.hasOwnProperty.call(info.body, TENANT_FIELD)) deny();
  if (Object.prototype.hasOwnProperty.call(info.body, "name_normalized")) deny();

  const name = Object.prototype.hasOwnProperty.call(info.body, "name")
    ? info.body.name
    : record.get("name");
  if (typeof name !== "string" || name.trim() === "") {
    throw new BadRequestError("organizational_unit_name_required");
  }
  const trimmedName = name.trim();
  if (trimmedName.length > 200) {
    throw new BadRequestError("organizational_unit_name_too_long");
  }
  info.body.name = trimmedName;
  info.body.name_normalized = trimmedName.toLowerCase();
  info.body[TENANT_FIELD] = tenantId;
  record.set("name", trimmedName);
  record.set("name_normalized", info.body.name_normalized);
  record.set(TENANT_FIELD, tenantId);
}

function memberCount(record) {
  return $app.findRecordsByFilter(
    USER_COLLECTION,
    "tenant = {:tenant} && organizational_unit = {:group}",
    "",
    0,
    0,
    {
      tenant: record.get(TENANT_FIELD),
      group: record.id,
    },
  ).length;
}

function guardOrganizationalUnitDelete(record) {
  if (memberCount(record) > 0) {
    throw new BadRequestError("organizational_unit_has_members");
  }
}

function groupsProjectionRoute(event) {
  const context = applicationContext({
    ...event,
    collection: {
      name: ORGANIZATIONAL_UNIT_COLLECTION,
      fields: [{ name: TENANT_FIELD }],
    },
  });
  // This route always requires a tenant-scoped authenticated administrator.
  if (!context) deny();
  if (context.auth.get("role") !== "administrator") deny();

  const groupId = event.request.pathValue("id");
  let groups;
  if (groupId) {
    try {
      const group = $app.findRecordById(ORGANIZATIONAL_UNIT_COLLECTION, groupId);
      if (group.get(TENANT_FIELD) !== context.context.tenant.id) {
        throw new NotFoundError("group_not_found");
      }
      groups = [group];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new NotFoundError("group_not_found");
    }
  } else {
    groups = $app.findRecordsByFilter(
      ORGANIZATIONAL_UNIT_COLLECTION,
      "tenant = {:tenant}",
      "name",
      0,
      0,
      { tenant: context.context.tenant.id },
    );
  }
  const items = groups.map((record) => ({
    id: record.id,
    name: record.get("name"),
    created: record.get("created"),
    updated: record.get("updated"),
    member_count: memberCount(record),
  }));
  return event.json(200, groupId ? items[0] : { items });
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

function deleteRecord(event) {
  const context = applicationContext(event);
  if (!context) return event.next();
  ensureRecordTenant(event.record, context.context.tenant.id);
  if (collectionName({ record: event.record }) === ORGANIZATIONAL_UNIT_COLLECTION) {
    guardOrganizationalUnitDelete(event.record);
  }
  return event.next();
}

function createRecord(event) {
  const context = applicationContext(event);
  if (!context) return event.next();

  if (collectionName({ record: event.record }) === ORGANIZATIONAL_UNIT_COLLECTION) {
    normalizeOrganizationalUnit(context.info, event.record, context.context.tenant.id);
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
  if (collectionName({ record: event.record }) === ORGANIZATIONAL_UNIT_COLLECTION) {
    normalizeOrganizationalUnit(context.info, event.record, context.context.tenant.id);
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

module.exports = {
  checkRecords,
  createRecord,
  deleteRecord,
  groupsProjectionRoute,
  rejectInactive,
  updateRecord,
};
