const authConfig = require(`${__hooks}/auth-config.cjs`);
const tenantResolver = require(`${__hooks}/tenant-host-resolver.cjs`);

const configuration = authConfig.validateAuthConfig(authConfig.readPocketBaseEnvironment());
const TENANT_FIELD = "tenant";
const USER_COLLECTION = "users";
const ORGANIZATIONAL_UNIT_COLLECTION = "organizational_units";
const BOOKING_TYPE_COLLECTION = "booking_types";
const RESOURCE_COLLECTION = "resources";
const BOOKING_COLLECTION = "bookings";
const PROTECTED_USER_FIELDS = [
  "email",
  "email_normalized",
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

function normalizeBookingType(event, info, record, tenantId) {
  const missing = String(Math.random());
  const raw = new DynamicModel({ name_normalized: missing });
  event.bindBody(raw);
  if (raw.name_normalized !== missing) deny();

  const name = Object.prototype.hasOwnProperty.call(info.body, "name")
    ? info.body.name
    : record.get("name");
  if (typeof name !== "string" || name.trim() === "") {
    throw new BadRequestError("booking_type_name_required");
  }
  const trimmedName = name.trim();
  if (trimmedName.length > 200) {
    throw new BadRequestError("booking_type_name_too_long");
  }
  info.body.name = trimmedName;
  info.body.name_normalized = trimmedName.toLowerCase();
  info.body[TENANT_FIELD] = tenantId;
  record.set("name", trimmedName);
  record.set("name_normalized", info.body.name_normalized);
  record.set(TENANT_FIELD, tenantId);
}

function normalizeResource(event, info, record, tenantId) {
  const missing = String(Math.random());
  const raw = new DynamicModel({ name_normalized: missing });
  event.bindBody(raw);
  if (raw.name_normalized !== missing) deny();
  if (Object.prototype.hasOwnProperty.call(info.body, TENANT_FIELD)) deny();
  if (Object.prototype.hasOwnProperty.call(info.body, "name_normalized")) deny();
  if (Object.prototype.hasOwnProperty.call(info.body, "archived_at")) deny();

  const name = Object.prototype.hasOwnProperty.call(info.body, "name")
    ? info.body.name
    : record.get("name");
  if (typeof name !== "string" || name.trim() === "") {
    throw new BadRequestError("resource_name_required");
  }
  const trimmedName = name.trim();
  if (trimmedName.length > 200) {
    throw new BadRequestError("resource_name_too_long");
  }

  const rate = Object.prototype.hasOwnProperty.call(info.body, "base_rate_minor_units")
    ? info.body.base_rate_minor_units
    : record.get("base_rate_minor_units");
  if (typeof rate !== "number" || !Number.isSafeInteger(rate) || rate < 0) {
    throw new BadRequestError("resource_base_rate_invalid");
  }

  info.body.name = trimmedName;
  info.body.name_normalized = trimmedName.toLowerCase();
  info.body.base_rate_minor_units = rate;
  info.body[TENANT_FIELD] = tenantId;
  record.set("name", trimmedName);
  record.set("name_normalized", info.body.name_normalized);
  record.set("base_rate_minor_units", rate);
  record.set(TENANT_FIELD, tenantId);
}

const PROTECTED_BOOKING_FIELDS = [
  TENANT_FIELD,
  "created_by_user",
  "resource_base_rate_minor_units",
  "booking_type_surcharge_minor_units",
  "effective_rate_minor_units",
  "booker_display_name_snapshot",
  "booker_group_snapshot",
  "booker_email_snapshot",
  "resource_name_snapshot",
  "booking_type_name_snapshot",
];

function hasField(body, field) {
  return Object.prototype.hasOwnProperty.call(body, field);
}

function relationValue(value, code) {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value !== "string" || value.trim() === "") {
    throw new BadRequestError(code);
  }
  return value;
}

function findTenantRecord(collection, id, tenantId, code) {
  const relation = relationValue(id, code);
  if (!relation) throw new BadRequestError(code);

  let record;
  try {
    record = $app.findRecordById(collection, relation);
  } catch {
    throw new BadRequestError(code);
  }
  if (record.get(TENANT_FIELD) !== tenantId) throw new BadRequestError(code);
  return record;
}

function parseBookingDate(value, code) {
  if (value === null || value === undefined) {
    throw new BadRequestError(code);
  }
  const normalized = String(value).trim();
  if (normalized === "") throw new BadRequestError(code);
  const timestamp = Date.parse(normalized);
  if (!Number.isFinite(timestamp)) throw new BadRequestError(code);

  const date = new Date(timestamp);
  if (
    date.getUTCSeconds() !== 0 ||
    date.getUTCMilliseconds() !== 0 ||
    date.getUTCMinutes() % 15 !== 0
  ) {
    throw new BadRequestError("booking_time_alignment_invalid");
  }
  return date;
}

function userDisplayName(record) {
  return [record.get("first_name"), record.get("last_name")]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .join(" ");
}

function bookingUserGroupName(user, tenantId) {
  const group = findTenantRecord(
    ORGANIZATIONAL_UNIT_COLLECTION,
    user.get("organizational_unit"),
    tenantId,
    "booking_user_group_invalid",
  );
  return group.get("name");
}

function ensureBookingRate(value, code) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new BadRequestError(code);
  }
  return value;
}

function hasDateValue(record, field) {
  const value = record.get(field);
  return value !== null && value !== undefined && String(value) !== "";
}

function normalizeBooking(event, info, record, context) {
  const body = info.body ?? {};
  const tenantId = context.context.tenant.id;
  const administrator = context.auth.get("role") === "administrator";

  for (const field of PROTECTED_BOOKING_FIELDS) {
    if (hasField(body, field)) deny();
  }

  const resource = findTenantRecord(
    RESOURCE_COLLECTION,
    body.resource,
    tenantId,
    "booking_resource_invalid",
  );
  if (hasDateValue(resource, "archived_at")) {
    throw new BadRequestError("booking_resource_archived");
  }

  let bookedForUser;
  if (administrator) {
    bookedForUser = findTenantRecord(
      USER_COLLECTION,
      body.booked_for_user,
      tenantId,
      "booking_booked_for_user_invalid",
    );
  } else {
    if (
      hasField(body, "booked_for_user") &&
      relationValue(body.booked_for_user, "booking_booked_for_user_invalid")
    ) {
      deny();
    }
    bookedForUser = context.auth;
    if (
      hasField(body, "booking_type") &&
      relationValue(body.booking_type, "booking_type_invalid")
    ) {
      deny();
    }
  }

  if (bookedForUser.get("active") !== true) {
    throw new BadRequestError("booking_booked_for_user_inactive");
  }

  let bookingType;
  const bookingTypeId = relationValue(body.booking_type, "booking_type_invalid");
  if (bookingTypeId) {
    if (!administrator) deny();
    bookingType = findTenantRecord(
      BOOKING_TYPE_COLLECTION,
      bookingTypeId,
      tenantId,
      "booking_type_invalid",
    );
    if (hasDateValue(bookingType, "archived_at")) {
      throw new BadRequestError("booking_type_archived");
    }
  }

  const start = parseBookingDate(body.start, "booking_start_invalid");
  const end = parseBookingDate(body.end, "booking_end_invalid");
  if (end <= start) throw new BadRequestError("booking_duration_invalid");

  const startValue = start.toISOString();
  const endValue = end.toISOString();
  const existingBookings = $app.findRecordsByFilter(
    BOOKING_COLLECTION,
    "tenant = {:tenant} && resource = {:resource} && start < {:end} && end > {:start}",
    "",
    0,
    0,
    { tenant: tenantId, resource: resource.id, start: startValue, end: endValue },
  );
  const overlaps = existingBookings.some((existing) => {
    const existingStart = Date.parse(String(existing.get("start")));
    const existingEnd = Date.parse(String(existing.get("end")));
    return existingStart < end.getTime() && existingEnd > start.getTime();
  });
  if (overlaps) throw new BadRequestError("booking_resource_conflict");

  const resourceRate = ensureBookingRate(
    resource.get("base_rate_minor_units"),
    "booking_resource_rate_invalid",
  );
  const bookingTypeSurcharge = bookingType
    ? ensureBookingRate(
        bookingType.get("surcharge_minor_units") || 0,
        "booking_type_surcharge_invalid",
      )
    : 0;
  const effectiveRate = resourceRate + bookingTypeSurcharge;
  if (!Number.isSafeInteger(effectiveRate)) {
    throw new BadRequestError("booking_effective_rate_invalid");
  }

  const groupName = bookingUserGroupName(bookedForUser, tenantId);
  const bookingTypeName = bookingType?.get("name") ?? "";
  info.body[TENANT_FIELD] = tenantId;
  info.body.resource = resource.id;
  info.body.booked_for_user = bookedForUser.id;
  info.body.created_by_user = context.auth.id;
  info.body.booking_type = bookingType?.id ?? "";
  info.body.start = startValue;
  info.body.end = endValue;
  info.body.resource_base_rate_minor_units = resourceRate;
  info.body.booking_type_surcharge_minor_units = bookingTypeSurcharge;
  info.body.effective_rate_minor_units = effectiveRate;
  info.body.booker_display_name_snapshot = userDisplayName(bookedForUser);
  info.body.booker_group_snapshot = groupName;
  info.body.booker_email_snapshot = bookedForUser.get("email");
  info.body.resource_name_snapshot = resource.get("name");
  info.body.booking_type_name_snapshot = bookingTypeName;

  record.set(TENANT_FIELD, tenantId);
  record.set("resource", resource.id);
  record.set("booked_for_user", bookedForUser.id);
  record.set("created_by_user", context.auth.id);
  record.set("booking_type", bookingType?.id ?? "");
  record.set("start", startValue);
  record.set("end", endValue);
  record.set("resource_base_rate_minor_units", resourceRate);
  record.set("booking_type_surcharge_minor_units", bookingTypeSurcharge);
  record.set("effective_rate_minor_units", effectiveRate);
  record.set("booker_display_name_snapshot", userDisplayName(bookedForUser));
  record.set("booker_group_snapshot", groupName);
  record.set("booker_email_snapshot", bookedForUser.get("email"));
  record.set("resource_name_snapshot", resource.get("name"));
  record.set("booking_type_name_snapshot", bookingTypeName);
}

function requestQueryValue(event, name) {
  return event.request.url.query().get(name) ?? "";
}

function bookingDateRange(event) {
  const start = parseBookingDate(requestQueryValue(event, "start"), "booking_range_start_invalid");
  const end = parseBookingDate(requestQueryValue(event, "end"), "booking_range_end_invalid");
  if (end <= start) throw new BadRequestError("booking_range_invalid");
  return { start, end };
}

function bookingProjection(record, administrator) {
  const projection = {
    id: record.id,
    resource: record.get("resource"),
    start: String(record.get("start")),
    end: String(record.get("end")),
    booker_display_name: record.get("booker_display_name_snapshot"),
  };
  if (administrator) {
    projection.booking_type = record.get("booking_type") || null;
    projection.booking_type_name = record.get("booking_type_name_snapshot") || null;
    projection.booked_for_user = record.get("booked_for_user");
    projection.created_by_user = record.get("created_by_user");
  }
  return projection;
}

function bookingRecordsForRange(tenantId, resourceId, start, end) {
  const filter = resourceId ? "tenant = {:tenant} && resource = {:resource}" : "tenant = {:tenant}";
  const records = $app.findRecordsByFilter(
    BOOKING_COLLECTION,
    filter,
    "start,id",
    0,
    0,
    resourceId ? { tenant: tenantId, resource: resourceId } : { tenant: tenantId },
  );
  return records.filter((record) => {
    const existingStart = Date.parse(String(record.get("start")));
    const existingEnd = Date.parse(String(record.get("end")));
    return existingStart < end.getTime() && existingEnd > start.getTime();
  });
}

function calendarBookingsRoute(event) {
  const context = applicationContext({
    ...event,
    collection: { name: BOOKING_COLLECTION, fields: [{ name: TENANT_FIELD }] },
  });
  if (!context) deny();

  const { start, end } = bookingDateRange(event);
  const resourceId = requestQueryValue(event, "resource") || undefined;
  if (resourceId) {
    findTenantRecord(
      RESOURCE_COLLECTION,
      resourceId,
      context.context.tenant.id,
      "booking_resource_invalid",
    );
  }
  const items = bookingRecordsForRange(context.context.tenant.id, resourceId, start, end).map(
    (record) => bookingProjection(record, context.auth.get("role") === "administrator"),
  );
  return event.json(200, { items });
}

function calendarBookingCreateRoute(event) {
  const collection = $app.findCollectionByNameOrId(BOOKING_COLLECTION);
  const context = applicationContext({ ...event, collection });
  if (!context) deny();

  const record = new Record(collection);
  normalizeBooking(event, context.info, record, context);
  $app.saveNoValidate(record);
  return event.json(200, bookingProjection(record, context.auth.get("role") === "administrator"));
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

function calendarResourcesRoute(event) {
  const context = applicationContext({
    ...event,
    collection: {
      name: RESOURCE_COLLECTION,
      fields: [{ name: TENANT_FIELD }],
    },
  });
  if (!context) deny();

  const resources = $app.findRecordsByFilter(
    RESOURCE_COLLECTION,
    'tenant = {:tenant} && archived_at = ""',
    "name_normalized,id",
    0,
    0,
    { tenant: context.context.tenant.id },
  );
  const items = resources.map((record) => ({
    id: record.id,
    name: record.get("name"),
  }));
  return event.json(200, { items });
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
    normalizeOrganizationalUnit(event, context.info, event.record, context.context.tenant.id);
  } else if (collectionName({ record: event.record }) === BOOKING_TYPE_COLLECTION) {
    normalizeBookingType(event, context.info, event.record, context.context.tenant.id);
  } else if (collectionName({ record: event.record }) === RESOURCE_COLLECTION) {
    normalizeResource(event, context.info, event.record, context.context.tenant.id);
  } else if (collectionName({ record: event.record }) === BOOKING_COLLECTION) {
    normalizeBooking(event, context.info, event.record, context);
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
    normalizeOrganizationalUnit(event, context.info, event.record, context.context.tenant.id);
  } else if (collectionName({ record: event.record }) === BOOKING_TYPE_COLLECTION) {
    normalizeBookingType(event, context.info, event.record, context.context.tenant.id);
  } else if (collectionName({ record: event.record }) === RESOURCE_COLLECTION) {
    normalizeResource(event, context.info, event.record, context.context.tenant.id);
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

function administratorContext(event) {
  const context = applicationContext({
    ...event,
    collection: {
      name: USER_COLLECTION,
      fields: [{ name: TENANT_FIELD }],
    },
  });
  if (!context || context.auth.get("role") !== "administrator") deny();
  return context;
}

module.exports = {
  calendarBookingCreateRoute,
  calendarBookingsRoute,
  checkRecords,
  calendarResourcesRoute,
  createRecord,
  deleteRecord,
  groupsProjectionRoute,
  administratorContext,
  rejectInactive,
  updateRecord,
};
