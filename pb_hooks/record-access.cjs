const authConfig = require(`${__hooks}/auth-config.cjs`);
const tenantResolver = require(`${__hooks}/tenant-host-resolver.cjs`);

const configuration = authConfig.validateAuthConfig(authConfig.readPocketBaseEnvironment());
const TENANT_FIELD = "tenant";
const TENANT_COLLECTION = "tenants";
const USER_COLLECTION = "users";
const ORGANIZATIONAL_UNIT_COLLECTION = "organizational_units";
const BOOKING_TYPE_COLLECTION = "booking_types";
const RESOURCE_COLLECTION = "resources";
const BOOKING_COLLECTION = "bookings";
const TENANT_SETTINGS_COLLECTION = "tenant_settings";
const DEFAULT_SITE_TITLE = "Asset Calendar";
const DEFAULT_BOOKING_LOCK_HOURS = 24;
const BOOKING_TYPE_COLORS = new Set([
  "#3E7D98",
  "#168C6C",
  "#CF7B36",
  "#B42318",
  "#52606D",
  "#7A5C00",
]);
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

function tenantSettingsRecord(tenantId, createIfMissing = false) {
  let collection;
  try {
    collection = $app.findCollectionByNameOrId(TENANT_SETTINGS_COLLECTION);
  } catch {
    return null;
  }

  try {
    return $app.findFirstRecordByData(collection, TENANT_FIELD, tenantId);
  } catch {
    if (!createIfMissing) return null;
    const record = new Record(collection);
    record.set(TENANT_FIELD, tenantId);
    record.set("site_title", DEFAULT_SITE_TITLE);
    record.set("booking_lock_hours", DEFAULT_BOOKING_LOCK_HOURS);
    $app.save(record);
    return record;
  }
}

function bookingLockMilliseconds(tenantId) {
  const settings = tenantSettingsRecord(tenantId, true);
  const hours = settings?.get("booking_lock_hours") ?? DEFAULT_BOOKING_LOCK_HOURS;
  if (!Number.isSafeInteger(hours) || hours < 0) {
    throw new BadRequestError("tenant_settings_booking_lock_hours_invalid");
  }
  return hours * 60 * 60 * 1000;
}

function ensureTenantSettings(record) {
  if (collectionName({ record }) !== "tenants") return;
  tenantSettingsRecord(record.id, true);
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
  const nonbillable = hasField(info.body, "nonbillable")
    ? info.body.nonbillable
    : record.get("nonbillable") === true;
  if (typeof nonbillable !== "boolean") {
    throw new BadRequestError("booking_type_nonbillable_invalid");
  }
  const configuredSurcharge = hasField(info.body, "surcharge_minor_units")
    ? info.body.surcharge_minor_units
    : record.get("surcharge_minor_units") || 0;
  if (
    typeof configuredSurcharge !== "number" ||
    !Number.isSafeInteger(configuredSurcharge) ||
    configuredSurcharge < 0
  ) {
    throw new BadRequestError("booking_type_surcharge_invalid");
  }
  const configuredColor = Object.prototype.hasOwnProperty.call(info.body, "color")
    ? info.body.color
    : record.get("color");
  const color =
    configuredColor === undefined || configuredColor === null || configuredColor === ""
      ? null
      : configuredColor;
  if (color !== null && (typeof color !== "string" || !BOOKING_TYPE_COLORS.has(color))) {
  }
  info.body.name = trimmedName;
  info.body.name_normalized = trimmedName.toLowerCase();
  info.body.nonbillable = nonbillable;
  info.body.surcharge_minor_units = nonbillable ? 0 : configuredSurcharge;
  info.body.color = color;
  info.body[TENANT_FIELD] = tenantId;
  record.set("name", trimmedName);
  record.set("name_normalized", info.body.name_normalized);
  record.set("nonbillable", nonbillable);
  record.set("surcharge_minor_units", info.body.surcharge_minor_units);
  record.set("color", color);
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
  "booking_type_color_snapshot",
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

function pocketBaseDateValue(date) {
  return date.toISOString().replace("T", " ");
}

function userDisplayName(record) {
  const name = [record.get("first_name"), record.get("last_name")]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .join(" ");
  return name || String(record.get("email") || "").trim();
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
    {
      tenant: tenantId,
      resource: resource.id,
      start: pocketBaseDateValue(start),
      end: pocketBaseDateValue(end),
    },
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
  const nonbillable = bookingType?.get("nonbillable") === true;
  const storedResourceRate = nonbillable ? 0 : resourceRate;
  const bookingTypeSurcharge =
    bookingType && !nonbillable
      ? ensureBookingRate(
          bookingType.get("surcharge_minor_units") || 0,
          "booking_type_surcharge_invalid",
        )
      : 0;
  const effectiveRate = storedResourceRate + bookingTypeSurcharge;
  if (!Number.isSafeInteger(effectiveRate)) {
    throw new BadRequestError("booking_effective_rate_invalid");
  }

  const groupName = bookingUserGroupName(bookedForUser, tenantId);
  const bookingTypeName = bookingType?.get("name") ?? "";
  const bookingTypeColor = bookingType?.get("color") || "";
  info.body[TENANT_FIELD] = tenantId;
  info.body.resource = resource.id;
  info.body.booked_for_user = bookedForUser.id;
  info.body.created_by_user = context.auth.id;
  info.body.booking_type = bookingType?.id ?? "";
  info.body.start = startValue;
  info.body.end = endValue;
  info.body.resource_base_rate_minor_units = storedResourceRate;
  info.body.booking_type_surcharge_minor_units = bookingTypeSurcharge;
  info.body.effective_rate_minor_units = effectiveRate;
  info.body.booker_display_name_snapshot = userDisplayName(bookedForUser);
  info.body.booker_group_snapshot = groupName;
  info.body.booker_email_snapshot = bookedForUser.get("email");
  info.body.resource_name_snapshot = resource.get("name");
  info.body.booking_type_name_snapshot = bookingTypeName;
  info.body.booking_type_color_snapshot = bookingTypeColor;

  record.set(TENANT_FIELD, tenantId);
  record.set("resource", resource.id);
  record.set("booked_for_user", bookedForUser.id);
  record.set("created_by_user", context.auth.id);
  record.set("booking_type", bookingType?.id ?? "");
  record.set("start", startValue);
  record.set("end", endValue);
  record.set("resource_base_rate_minor_units", storedResourceRate);
  record.set("booking_type_surcharge_minor_units", bookingTypeSurcharge);
  record.set("effective_rate_minor_units", effectiveRate);
  record.set("booker_display_name_snapshot", userDisplayName(bookedForUser));
  record.set("booker_group_snapshot", groupName);
  record.set("booker_email_snapshot", bookedForUser.get("email"));
  record.set("resource_name_snapshot", resource.get("name"));
  record.set("booking_type_name_snapshot", bookingTypeName);
  record.set("booking_type_color_snapshot", bookingTypeColor);
}

function normalizeBookingUpdate(
  event,
  info,
  record,
  context,
  bookingLockMs,
  storedRecord = record,
) {
  const body = info.body ?? {};
  const tenantId = context.context.tenant.id;
  const administrator = context.auth.get("role") === "administrator";
  const currentStart = parseBookingDate(storedRecord.get("start"), "booking_start_invalid");

  const allowedFields = administrator
    ? ["start", "end", "booked_for_user", "booking_type"]
    : ["start", "end"];
  for (const field of Object.keys(body)) {
    if (!allowedFields.includes(field)) deny();
  }
  for (const field of PROTECTED_BOOKING_FIELDS) {
    if (hasField(body, field)) deny();
  }
  if (hasField(body, "resource")) deny();

  if (!administrator && (hasField(body, "booked_for_user") || hasField(body, "booking_type"))) {
    deny();
  }

  const start = parseBookingDate(
    hasField(body, "start") ? body.start : storedRecord.get("start"),
    "booking_start_invalid",
  );
  const end = parseBookingDate(
    hasField(body, "end") ? body.end : storedRecord.get("end"),
    "booking_end_invalid",
  );
  if (end <= start) throw new BadRequestError("booking_duration_invalid");

  if (!administrator && bookingLockMs > 0) {
    if (record.get("booked_for_user") !== context.auth.id) deny();
    if (currentStart.getTime() - Date.now() < bookingLockMs) {
      throw new BadRequestError("booking_edit_window_closed");
    }
    if (start.getTime() - Date.now() < bookingLockMs) {
      throw new BadRequestError("booking_edit_start_too_soon");
    }
  } else if (!administrator && record.get("booked_for_user") !== context.auth.id) {
    deny();
  }

  const existingBookings = $app.findRecordsByFilter(
    BOOKING_COLLECTION,
    "tenant = {:tenant} && resource = {:resource} && id != {:id} && start < {:end} && end > {:start}",
    "",
    0,
    0,
    {
      tenant: tenantId,
      resource: storedRecord.get("resource"),
      id: storedRecord.id,
      start: pocketBaseDateValue(start),
      end: pocketBaseDateValue(end),
    },
  );
  const overlaps = existingBookings.some((existing) => {
    const existingStart = Date.parse(String(existing.get("start")));
    const existingEnd = Date.parse(String(existing.get("end")));
    return existingStart < end.getTime() && existingEnd > start.getTime();
  });
  if (overlaps) throw new BadRequestError("booking_resource_conflict");

  record.set("start", start.toISOString());
  record.set("end", end.toISOString());
  info.body.start = start.toISOString();
  info.body.end = end.toISOString();

  if (!administrator || (!hasField(body, "booked_for_user") && !hasField(body, "booking_type"))) {
    return;
  }

  const bookedForUser = findTenantRecord(
    USER_COLLECTION,
    hasField(body, "booked_for_user") ? body.booked_for_user : storedRecord.get("booked_for_user"),
    tenantId,
    "booking_booked_for_user_invalid",
  );
  if (hasField(body, "booked_for_user") && bookedForUser.get("active") !== true) {
    throw new BadRequestError("booking_booked_for_user_inactive");
  }

  const bookingTypeId = relationValue(
    hasField(body, "booking_type") ? body.booking_type : storedRecord.get("booking_type"),
    "booking_type_invalid",
  );
  let bookingType;
  if (bookingTypeId) {
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

  const resource = findTenantRecord(
    RESOURCE_COLLECTION,
    storedRecord.get("resource"),
    tenantId,
    "booking_resource_invalid",
  );
  const resourceRate = ensureBookingRate(
    resource.get("base_rate_minor_units"),
    "booking_resource_rate_invalid",
  );
  const nonbillable = bookingType?.get("nonbillable") === true;
  const storedResourceRate = nonbillable ? 0 : resourceRate;
  const bookingTypeSurcharge =
    bookingType && !nonbillable
      ? ensureBookingRate(
          bookingType.get("surcharge_minor_units") || 0,
          "booking_type_surcharge_invalid",
        )
      : 0;
  const effectiveRate = storedResourceRate + bookingTypeSurcharge;
  if (!Number.isSafeInteger(effectiveRate)) {
    throw new BadRequestError("booking_effective_rate_invalid");
  }

  const groupName = bookingUserGroupName(bookedForUser, tenantId);
  const bookingTypeName = bookingType?.get("name") ?? "";
  const bookingTypeColor =
    hasField(body, "booking_type") && body.booking_type !== storedRecord.get("booking_type")
      ? bookingType?.get("color") || ""
      : storedRecord.get("booking_type_color_snapshot") || "";
  info.body.booked_for_user = bookedForUser.id;
  info.body.booking_type = bookingType?.id ?? "";
  info.body.resource_base_rate_minor_units = storedResourceRate;
  info.body.booking_type_surcharge_minor_units = bookingTypeSurcharge;
  info.body.effective_rate_minor_units = effectiveRate;
  info.body.booker_display_name_snapshot = userDisplayName(bookedForUser);
  info.body.booker_group_snapshot = groupName;
  info.body.booker_email_snapshot = bookedForUser.get("email");
  info.body.resource_name_snapshot = resource.get("name");
  info.body.booking_type_name_snapshot = bookingTypeName;
  info.body.booking_type_color_snapshot = bookingTypeColor;

  record.set("booked_for_user", bookedForUser.id);
  record.set("booking_type", bookingType?.id ?? "");
  record.set("resource_base_rate_minor_units", storedResourceRate);
  record.set("booking_type_surcharge_minor_units", bookingTypeSurcharge);
  record.set("effective_rate_minor_units", effectiveRate);
  record.set("booker_display_name_snapshot", userDisplayName(bookedForUser));
  record.set("booker_group_snapshot", groupName);
  record.set("booker_email_snapshot", bookedForUser.get("email"));
  record.set("resource_name_snapshot", resource.get("name"));
  record.set("booking_type_name_snapshot", bookingTypeName);
  record.set("booking_type_color_snapshot", bookingTypeColor);
}

function normalizeTenantSettings(event, info, record, context) {
  if (context.auth.get("role") !== "administrator") deny();

  const body = info.body ?? {};
  for (const field of Object.keys(body)) {
    if (!["site_title", "booking_lock_hours"].includes(field)) deny();
  }

  const siteTitle = hasField(body, "site_title") ? body.site_title : record.get("site_title");
  if (typeof siteTitle !== "string" || siteTitle.trim() === "" || siteTitle.trim().length > 200) {
    throw new BadRequestError("tenant_settings_site_title_invalid");
  }

  const bookingLockHours = hasField(body, "booking_lock_hours")
    ? body.booking_lock_hours
    : record.get("booking_lock_hours");
  if (!Number.isSafeInteger(bookingLockHours) || bookingLockHours < 0) {
    throw new BadRequestError("tenant_settings_booking_lock_hours_invalid");
  }

  record.set("site_title", siteTitle.trim());
  record.set("booking_lock_hours", bookingLockHours);
  info.body.site_title = siteTitle.trim();
  info.body.booking_lock_hours = bookingLockHours;
}

function authorizeBookingDelete(record, context, bookingLockMs) {
  if (context.auth.get("role") === "administrator") return;
  if (record.get("booked_for_user") !== context.auth.id) deny();
  const start = parseBookingDate(record.get("start"), "booking_start_invalid");
  if (bookingLockMs > 0 && start.getTime() - Date.now() < bookingLockMs) {
    throw new BadRequestError("booking_delete_window_closed");
  }
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

function bookingProjection(record, administrator, authId, bookingLockMs) {
  const currentStart = Date.parse(String(record.get("start")));
  const regularEligible =
    record.get("booked_for_user") === authId &&
    (bookingLockMs === 0 || currentStart - Date.now() >= bookingLockMs);
  const projection = {
    id: record.id,
    resource: record.get("resource"),
    start: String(record.get("start")),
    end: String(record.get("end")),
    booker_display_name: record.get("booker_display_name_snapshot"),
    can_edit: administrator || regularEligible,
    can_delete: administrator || regularEligible,
  };
  projection.booking_type_name = record.get("booking_type_name_snapshot") || null;
  projection.booking_type_color = record.get("booking_type_color_snapshot") || null;
  if (administrator) {
    projection.booking_type = record.get("booking_type") || null;
    projection.booked_for_user = record.get("booked_for_user");
    projection.created_by_user = record.get("created_by_user");
  }
  return projection;
}

function bookingRecordsForRange(tenantId, resourceId, start, end) {
  const filter = resourceId
    ? "tenant = {:tenant} && resource = {:resource} && start < {:end} && end > {:start}"
    : "tenant = {:tenant} && start < {:end} && end > {:start}";
  const records = $app.findRecordsByFilter(
    BOOKING_COLLECTION,
    filter,
    "start,id",
    0,
    0,
    resourceId
      ? {
          tenant: tenantId,
          resource: resourceId,
          start: pocketBaseDateValue(start),
          end: pocketBaseDateValue(end),
        }
      : {
          tenant: tenantId,
          start: pocketBaseDateValue(start),
          end: pocketBaseDateValue(end),
        },
  );
  return records.filter((record) => {
    const existingStart = Date.parse(String(record.get("start")));
    const existingEnd = Date.parse(String(record.get("end")));
    return existingStart < end.getTime() && existingEnd > start.getTime();
  });
}

function billingQueryValue(event, name) {
  return event.request.url.query().get(name) ?? "";
}

function applicationDateToUtc(value, code) {
  const normalized = String(value ?? "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) throw new BadRequestError(code);

  const [, year, month, day] = match;
  const yearNumber = Number(year);
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  const hourNumber = 0;
  const candidate = Date.UTC(yearNumber, monthNumber - 1, dayNumber);
  const candidateDate = new Date(candidate);
  if (
    candidateDate.getUTCFullYear() !== yearNumber ||
    candidateDate.getUTCMonth() !== monthNumber - 1 ||
    candidateDate.getUTCDate() !== dayNumber ||
    candidateDate.getUTCHours() !== hourNumber
  ) {
    throw new BadRequestError(code);
  }

  const lastSunday = (year, month) => {
    const lastDay = new Date(Date.UTC(year, month + 1, 0));
    return lastDay.getUTCDate() - lastDay.getUTCDay();
  };
  const marchSunday = lastSunday(yearNumber, 2);
  const octoberSunday = lastSunday(yearNumber, 9);
  const isAfterSummerTimeStart =
    monthNumber > 3 ||
    (monthNumber === 3 &&
      (dayNumber > marchSunday || (dayNumber === marchSunday && hourNumber >= 2)));
  const isBeforeSummerTimeEnd =
    monthNumber < 10 ||
    (monthNumber === 10 &&
      (dayNumber < octoberSunday || (dayNumber === octoberSunday && hourNumber < 3)));
  const offsetMinutes = isAfterSummerTimeStart && isBeforeSummerTimeEnd ? 120 : 60;
  return new Date(candidate - offsetMinutes * 60 * 1000);
}

function nextApplicationDate(value, code) {
  const normalized = String(value ?? "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) throw new BadRequestError(code);
  const candidate = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const date = new Date(candidate);
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  ) {
    throw new BadRequestError(code);
  }
  return new Date(candidate + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function billingInterval(event) {
  const startValue = billingQueryValue(event, "start");
  const endValue = billingQueryValue(event, "end");
  const start = applicationDateToUtc(startValue, "billing_start_invalid");
  const end = applicationDateToUtc(endValue, "billing_end_invalid");
  if (end <= start) throw new BadRequestError("billing_interval_invalid");
  return { start, end, startValue, endValue };
}

function formatDecimal(numerator, denominator, fractionDigits = 6) {
  const scale = 10n ** BigInt(fractionDigits);
  const scaled = (numerator * scale + denominator / 2n) / denominator;
  const whole = scaled / scale;
  const fraction = String(scaled % scale)
    .padStart(fractionDigits, "0")
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

function roundHalfUp(numerator, denominator) {
  const whole = numerator / denominator;
  const remainder = numerator % denominator;
  return whole + (remainder * 2n >= denominator ? 1n : 0n);
}

function amountFromMinorUnits(minorUnits) {
  const value = String(minorUnits);
  const sign = value.startsWith("-") ? "-" : "";
  const digits = sign ? value.slice(1) : value;
  return `${sign}${digits.slice(0, -2) || "0"}.${digits.slice(-2).padStart(2, "0")}`;
}

function billingRow(record) {
  const start = new Date(String(record.get("start")));
  const end = new Date(String(record.get("end")));
  const durationMilliseconds = end.getTime() - start.getTime();
  if (!Number.isFinite(durationMilliseconds) || durationMilliseconds <= 0) {
    throw new BadRequestError("billing_booking_duration_invalid");
  }

  const durationNumerator = BigInt(durationMilliseconds);
  const durationDenominator = 60n * 60n * 1000n;
  const effectiveRate = record.get("effective_rate_minor_units");
  if (!Number.isSafeInteger(effectiveRate) || effectiveRate < 0) {
    throw new BadRequestError("billing_effective_rate_invalid");
  }
  const amountMinorUnits = roundHalfUp(
    BigInt(effectiveRate) * durationNumerator,
    durationDenominator,
  );
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    duration_hours: formatDecimal(durationNumerator, durationDenominator),
    booker: String(record.get("booker_display_name_snapshot") || ""),
    group: String(record.get("booker_group_snapshot") || ""),
    resource: String(record.get("resource_name_snapshot") || ""),
    booking_type: String(record.get("booking_type_name_snapshot") || ""),
    amount: amountFromMinorUnits(amountMinorUnits),
    amount_minor_units: amountMinorUnits,
  };
}

function billingProjection(event) {
  const context = applicationContext({
    ...event,
    collection: { name: BOOKING_COLLECTION, fields: [{ name: TENANT_FIELD }] },
  });
  if (!context || context.auth.get("role") !== "administrator") deny();

  const interval = billingInterval(event);
  const records = $app.findRecordsByFilter(
    BOOKING_COLLECTION,
    "tenant = {:tenant} && start < {:end}",
    "start,id",
    0,
    0,
    {
      tenant: context.context.tenant.id,
      start: pocketBaseDateValue(interval.start),
      end: pocketBaseDateValue(interval.end),
    },
  );
  const rows = records
    .filter((record) => Date.parse(String(record.get("start"))) >= interval.start.getTime())
    .filter((record) => {
      const bookingTypeId = record.get("booking_type");
      if (!bookingTypeId) return true;
      try {
        const bookingType = $app.findRecordById(BOOKING_TYPE_COLLECTION, bookingTypeId);
        return (
          bookingType.get(TENANT_FIELD) === context.context.tenant.id &&
          bookingType.get("nonbillable") !== true
        );
      } catch {
        return true;
      }
    })
    .map(billingRow);

  const groups = new Map();
  let grandTotal = 0n;
  for (const row of rows) {
    const existing = groups.get(row.group) ?? { name: row.group, rows: [], total: 0n };
    existing.rows.push(row);
    existing.total += row.amount_minor_units;
    groups.set(row.group, existing);
    grandTotal += row.amount_minor_units;
  }

  return {
    start: interval.startValue,
    end: interval.endValue,
    groups: [...groups.values()].map((group) => ({
      name: group.name,
      records: group.rows.map(({ amount_minor_units: _amount, ...row }) => row),
      total: amountFromMinorUnits(group.total),
    })),
    total: amountFromMinorUnits(grandTotal),
    rows,
  };
}

function csvField(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function billingCsv(projection) {
  const columns = [
    "start",
    "end",
    "duration_hours",
    "booker",
    "group",
    "resource",
    "booking_type",
    "amount",
  ];
  const lines = [columns.join(",")];
  for (const row of projection.rows) {
    lines.push(columns.map((column) => csvField(row[column])).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

function billingExportRoute(event) {
  const projection = billingProjection(event);
  if (billingQueryValue(event, "format") === "csv") {
    const startDate = projection.start.slice(0, 10);
    const endDate = projection.end.slice(0, 10);
    event.response
      .header()
      .set("Content-Disposition", `attachment; filename="billing-${startDate}-${endDate}.csv"`);
    return event.blob(200, "text/csv; charset=utf-8", billingCsv(projection));
  }
  return event.json(200, {
    start: projection.start,
    end: projection.end,
    groups: projection.groups,
    total: projection.total,
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
  const bookingLockMs = bookingLockMilliseconds(context.context.tenant.id);
  const items = bookingRecordsForRange(context.context.tenant.id, resourceId, start, end).map(
    (record) =>
      bookingProjection(
        record,
        context.auth.get("role") === "administrator",
        context.auth.id,
        bookingLockMs,
      ),
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
  const bookingLockMs = bookingLockMilliseconds(context.context.tenant.id);
  return event.json(
    200,
    bookingProjection(
      record,
      context.auth.get("role") === "administrator",
      context.auth.id,
      bookingLockMs,
    ),
  );
}

function calendarBookingRecord(event, context) {
  const bookingId = event.request.pathValue("id");
  try {
    const record = $app.findRecordById(BOOKING_COLLECTION, bookingId);
    ensureRecordTenant(record, context.context.tenant.id);
    return record;
  } catch {
    throw new NotFoundError("booking_not_found");
  }
}

function calendarBookingDetailRoute(event) {
  const context = applicationContext({
    ...event,
    collection: { name: BOOKING_COLLECTION, fields: [{ name: TENANT_FIELD }] },
  });
  if (!context) deny();
  const record = calendarBookingRecord(event, context);
  const bookingLockMs = bookingLockMilliseconds(context.context.tenant.id);
  return event.json(
    200,
    bookingProjection(
      record,
      context.auth.get("role") === "administrator",
      context.auth.id,
      bookingLockMs,
    ),
  );
}

function calendarBookingUpdateRoute(event) {
  const collection = $app.findCollectionByNameOrId(BOOKING_COLLECTION);
  const context = applicationContext({ ...event, collection });
  if (!context) deny();
  const record = calendarBookingRecord(event, context);
  const bookingLockMs = bookingLockMilliseconds(context.context.tenant.id);
  normalizeBookingUpdate(event, context.info, record, context, bookingLockMs);
  $app.saveNoValidate(record);
  return event.json(
    200,
    bookingProjection(
      record,
      context.auth.get("role") === "administrator",
      context.auth.id,
      bookingLockMs,
    ),
  );
}

function calendarBookingDeleteRoute(event) {
  const collection = $app.findCollectionByNameOrId(BOOKING_COLLECTION);
  const context = applicationContext({ ...event, collection });
  if (!context) deny();
  const record = calendarBookingRecord(event, context);
  authorizeBookingDelete(record, context, bookingLockMilliseconds(context.context.tenant.id));
  $app.delete(record);
  return event.json(200, { id: record.id });
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
  } else if (collectionName({ record: event.record }) === BOOKING_COLLECTION) {
    authorizeBookingDelete(
      event.record,
      context,
      bookingLockMilliseconds(context.context.tenant.id),
    );
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
  } else if (collectionName({ record: event.record }) === TENANT_SETTINGS_COLLECTION) {
    deny();
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
  } else if (collectionName({ record: event.record }) === BOOKING_COLLECTION) {
    const storedBooking = $app.findRecordById(BOOKING_COLLECTION, event.record.id);
    normalizeBookingUpdate(
      event,
      context.info,
      event.record,
      context,
      bookingLockMilliseconds(context.context.tenant.id),
      storedBooking,
    );
  } else if (collectionName({ record: event.record }) === TENANT_SETTINGS_COLLECTION) {
    normalizeTenantSettings(event, context.info, event.record, context);
  } else {
    applyServerTenant(context.info, event.record, context.context.tenant.id);
  }
  ensureOrganizationalUnitTenant(context.info.body.organizational_unit, context.context.tenant.id);
  return event.next();
}

function afterCreateRecord(event) {
  if (collectionName({ record: event.record }) === TENANT_COLLECTION) {
    ensureTenantSettings(event.record);
  }
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
  afterCreateRecord,
  billingExportRoute,
  calendarBookingDeleteRoute,
  calendarBookingDetailRoute,
  calendarBookingCreateRoute,
  calendarBookingUpdateRoute,
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
