const TENANT_FIELD = "tenant";
const BOOKING_TYPE_COLLECTION = "booking_types";
const BOOKING_TYPE_SYSTEM_KINDS = ["regular", "training", "maintenance", "custom"];

function bookingTypeValue(info, record, field) {
  return Object.prototype.hasOwnProperty.call(info.body, field)
    ? info.body[field]
    : record.get(field);
}

function createBookingTypeAccess({ applicationContext, deny, isAdministrator }) {
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
    if (
      !isCreate &&
      (kind === "regular" || kind === "maintenance") &&
      Object.prototype.hasOwnProperty.call(info.body, "name") &&
      typeof info.body.name === "string" &&
      info.body.name.trim() !== record.get("name")
    ) {
      throw new BadRequestError("booking_type_name_protected");
    }
    const surcharge = bookingTypeValue(info, record, "surcharge_minor_units");
    if (isCreate && !Object.prototype.hasOwnProperty.call(info.body, "surcharge_minor_units")) {
      throw new BadRequestError("booking_type_surcharge_invalid");
    }
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
    if (!isCreate && kind === "maintenance" && surcharge > 0) {
      throw new BadRequestError("booking_type_maintenance_surcharge_protected");
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
    const previous = original ?? record;
    const wasArchived = original
      ? original.get("archived") === true
      : record.get("archived") === true && Boolean(record.get("archived_at"));
    if (wasArchived) deny();
    if (archived && kind !== "custom") {
      throw new BadRequestError("booking_type_archival_protected");
    }
    if (isCreate && archived) {
      throw new BadRequestError("booking_type_archival_irreversible");
    }
    if (
      !isCreate &&
      archived &&
      !wasArchived &&
      kind === "custom" &&
      ((Object.prototype.hasOwnProperty.call(info.body, "name") &&
        typeof info.body.name === "string" &&
        info.body.name.trim() !== previous.get("name")) ||
        (Object.prototype.hasOwnProperty.call(info.body, "surcharge_minor_units") &&
          surcharge !== previous.get("surcharge_minor_units")))
    ) {
      throw new BadRequestError("booking_type_archival_configuration_protected");
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

  function bookingTypesProjectionRoute(event, forceSelection = false) {
    const context = applicationContext({
      ...event,
      collection: { name: BOOKING_TYPE_COLLECTION, fields: [{ name: TENANT_FIELD }] },
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
      types = $app.findRecordsByFilter(
        BOOKING_TYPE_COLLECTION,
        filter,
        "name_normalized,id",
        0,
        0,
        {
          tenant: context.context.tenant.id,
        },
      );
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

  return { normalizeBookingType, bookingTypesProjectionRoute };
}

module.exports = { createBookingTypeAccess };
