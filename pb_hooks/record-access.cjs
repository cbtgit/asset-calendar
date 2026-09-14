/* eslint-disable max-lines */

const authConfig = require(`${__hooks}/auth-config.cjs`);
const tenantResolver = require(`${__hooks}/tenant-host-resolver.cjs`);

const configuration = authConfig.validateAuthConfig(authConfig.readPocketBaseEnvironment());
const TENANT_FIELD = "tenant";
const USER_COLLECTION = "users";
const ORGANIZATIONAL_UNIT_COLLECTION = "organizational_units";
const BOOKING_TYPE_COLLECTION = "booking_types";
const BOOKING_TYPE_SYSTEM_KINDS = ["regular", "training", "maintenance", "custom"];
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

function bookingTypeValue(info, record, field) {
  return Object.prototype.hasOwnProperty.call(info.body, field)
    ? info.body[field]
    : record.get(field);
}

// oxlint-disable-next-line eslint(complexity)
function normalizeBookingType(event, { info, record, tenantId, isCreate }) {
  if (
    Object.prototype.hasOwnProperty.call(info.body, TENANT_FIELD) ||
    Object.prototype.hasOwnProperty.call(info.body, "name_normalized") ||
    Object.prototype.hasOwnProperty.call(info.body, "archived_at")
  ) {
    deny();
  }

  const name = bookingTypeValue(info, record, "name");
  if (typeof name !== "string" || name.trim() === "") {
    throw new BadRequestError("booking_type_name_required");
  }
  const trimmedName = name.trim();
  if (trimmedName.length > 200) {
    throw new BadRequestError("booking_type_name_too_long");
  }

  const kind = bookingTypeValue(info, record, "system_kind");
  const surcharge = bookingTypeValue(info, record, "surcharge_minor_units");
  if (!BOOKING_TYPE_SYSTEM_KINDS.includes(kind)) {
    throw new BadRequestError("booking_type_system_kind_invalid");
  }
  if (!Number.isSafeInteger(surcharge) || surcharge < 0) {
    throw new BadRequestError("booking_type_surcharge_invalid");
  }
  if (isCreate && kind !== "custom") {
    throw new BadRequestError("booking_type_system_kind_protected");
  }
  if (!isCreate && kind !== record.get("system_kind")) {
    throw new BadRequestError("booking_type_system_kind_protected");
  }
  if (kind === "regular" && surcharge !== 0) {
    throw new BadRequestError("booking_type_regular_surcharge_protected");
  }
  if (kind === "regular" || kind === "training") {
    if (bookingTypeValue(info, record, "billable") !== true) {
      throw new BadRequestError("booking_type_billable_protected");
    }
    if (bookingTypeValue(info, record, "resource_blocking") !== true) {
      throw new BadRequestError("booking_type_blocking_protected");
    }
  }
  if (kind === "maintenance") {
    if (bookingTypeValue(info, record, "billable") !== false) {
      throw new BadRequestError("booking_type_maintenance_billable_protected");
    }
    if (bookingTypeValue(info, record, "resource_blocking") !== true) {
      throw new BadRequestError("booking_type_maintenance_blocking_protected");
    }
  }
  if (kind === "custom") {
    info.body.billable = true;
    info.body.resource_blocking = true;
    record.set("billable", true);
    record.set("resource_blocking", true);
  }

  const archived = bookingTypeValue(info, record, "archived");
  if (typeof archived !== "boolean") {
    throw new BadRequestError("booking_type_archived_invalid");
  }
  const original = typeof record.original === "function" ? record.original() : undefined;
  const wasArchived = original
    ? original.get("archived") === true
    : record.get("archived") === true && Boolean(record.get("archived_at"));
  if (wasArchived) {
    deny();
  }
  if (archived && kind !== "custom") {
    throw new BadRequestError("booking_type_archival_protected");
  }
  if (isCreate && archived) {
    throw new BadRequestError("booking_type_archival_irreversible");
  }

  info.body.name = trimmedName;
  info.body.name_normalized = trimmedName.toLowerCase();
  info.body[TENANT_FIELD] = tenantId;
  record.set("name", trimmedName);
  record.set("name_normalized", info.body.name_normalized);
  record.set(TENANT_FIELD, tenantId);
  if (archived && !wasArchived) {
    info.body.archived_at = new Date().toISOString();
    record.set("archived_at", info.body.archived_at);
  }
}

function applyServerTenant(info, record, tenantId) {
  if (recordTenant(record) !== undefined) {
    info.body[TENANT_FIELD] = tenantId;
    record.set(TENANT_FIELD, tenantId);
  }
}

function normalizeOrganizationalUnit(event, info, record, tenantId) {
  const missing = String(Math.random());
  const raw = new DynamicModel({ name_normalized: missing });
  event.bindBody(raw);
  if (raw.name_normalized !== missing) deny();
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
      "name_normalized,id",
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

// oxlint-disable-next-line eslint(complexity)
function bookingTypesProjectionRoute(event, forceSelection = false) {
  const context = applicationContext({
    ...event,
    collection: {
      name: BOOKING_TYPE_COLLECTION,
      fields: [{ name: TENANT_FIELD }],
    },
  });
  if (!context || !isAdministrator(context)) deny();

  const routeId = event.request.pathValue("id");
  const selection =
    forceSelection || event.request.pathValue("selection") || routeId === "selection";
  const id = selection ? undefined : routeId;
  const filter = selection ? "tenant = {:tenant} && archived = false" : "tenant = {:tenant}";
  let types;
  if (id) {
    try {
      const type = $app.findRecordById(BOOKING_TYPE_COLLECTION, id);
      if (type.get(TENANT_FIELD) !== context.context.tenant.id) {
        throw new NotFoundError("booking_type_not_found");
      }
      types = [type];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new NotFoundError("booking_type_not_found");
    }
  } else {
    types = $app.findRecordsByFilter(BOOKING_TYPE_COLLECTION, filter, "name_normalized,id", 0, 0, {
      tenant: context.context.tenant.id,
    });
  }
  const items = types.map((record) => ({
    id: record.id,
    name: record.get("name"),
    system_kind: record.get("system_kind"),
    surcharge_minor_units: record.get("surcharge_minor_units"),
    billable: record.get("billable"),
    resource_blocking: record.get("resource_blocking"),
    archived: record.get("archived"),
    archived_at: record.get("archived_at"),
  }));
  return event.json(200, id ? items[0] : { items });
}

function bookingTypesSelectionProjectionRoute(event) {
  return bookingTypesProjectionRoute(event, true);
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
    guardOrganizationalUnitDelete(event.record);
  }
  return event.next();
}

function createRecord(event) {
  const context = applicationContext(event);
  if (!context) return event.next();

  const collection = collectionName({ record: event.record });
  if (collection === RESOURCE_COLLECTION && context.auth.get("role") !== "administrator") deny();
  if (collection === ORGANIZATIONAL_UNIT_COLLECTION) {
    normalizeOrganizationalUnit(event, context.info, event.record, context.context.tenant.id);
  } else if (collectionName({ record: event.record }) === BOOKING_TYPE_COLLECTION) {
    if (!isAdministrator(context)) deny();
    normalizeBookingType(event, {
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
  if (collection === RESOURCE_COLLECTION && context.auth.get("role") !== "administrator") deny();
  if (collection === ORGANIZATIONAL_UNIT_COLLECTION) {
    normalizeOrganizationalUnit(event, context.info, event.record, context.context.tenant.id);
  } else if (collectionName({ record: event.record }) === BOOKING_TYPE_COLLECTION) {
    if (!isAdministrator(context)) deny();
    normalizeBookingType(event, {
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

module.exports = {
  checkRecords,
  createRecord,
  deleteRecord,
  applicationContext,
  deny,
  groupsProjectionRoute,
  bookingTypesProjectionRoute,
  bookingTypesSelectionProjectionRoute,
  rejectInactive,
  updateRecord,
};
