const recordAccess = require(`${__hooks}/record-access.cjs`);
const RESOURCE_COLLECTION = "resources";
const TENANT_FIELD = "tenant";

function resourceValue(info, record, field) {
  return Object.prototype.hasOwnProperty.call(info.body, field)
    ? info.body[field]
    : record.get(field);
}

// oxlint-disable-next-line complexity, max-params
function normalizeResource(event, info, record, tenantId, isCreate = false) {
  if (
    Object.prototype.hasOwnProperty.call(info.body, TENANT_FIELD) ||
    Object.prototype.hasOwnProperty.call(info.body, "name_normalized") ||
    Object.prototype.hasOwnProperty.call(info.body, "archived_at")
  ) {
    recordAccess.deny();
  }

  const name = resourceValue(info, record, "name");
  if (typeof name !== "string" || name.trim() === "") {
    throw new BadRequestError("resource_name_required");
  }
  const trimmedName = name.trim();
  if (trimmedName.length > 200) {
    throw new BadRequestError("resource_name_too_long");
  }
  const rate = resourceValue(info, record, "base_rate_minor_units");
  if (typeof rate !== "number" || !Number.isSafeInteger(rate) || rate < 0) {
    throw new BadRequestError("resource_base_rate_invalid");
  }

  const archived = resourceValue(info, record, "archived");
  if (typeof archived !== "boolean") {
    throw new BadRequestError("resource_archived_invalid");
  }
  const original = typeof record.original === "function" ? record.original() : undefined;
  if (isCreate && archived) {
    throw new BadRequestError("resource_archival_irreversible");
  }
  const wasArchived = original
    ? original.get("archived") === true
    : record.get("archived") === true && record.get("archived_at");
  if (wasArchived) recordAccess.deny();

  info.body.name = trimmedName;
  info.body.name_normalized = trimmedName.toLowerCase();
  info.body.base_rate_minor_units = rate;
  info.body[TENANT_FIELD] = tenantId;
  record.set("name", trimmedName);
  record.set("name_normalized", info.body.name_normalized);
  record.set("base_rate_minor_units", rate);
  record.set(TENANT_FIELD, tenantId);
  record.set("archived", archived);
  if (archived) {
    const archivedAt = new Date().toISOString();
    info.body.archived_at = archivedAt;
    record.set("archived_at", archivedAt);
  }
}

function resourceProjection(record, includeRate) {
  const projection = {
    id: record.id,
    name: record.get("name"),
    archived: record.get("archived") === true,
    created: record.get("created"),
    updated: record.get("updated"),
  };
  if (includeRate) projection.base_rate_minor_units = record.get("base_rate_minor_units");
  if (projection.archived) projection.archived_at = record.get("archived_at");
  return projection;
}

function resourcesProjectionRoute(event, forceActive = false) {
  const context = recordAccess.applicationContext({
    ...event,
    collection: { name: RESOURCE_COLLECTION, fields: [{ name: TENANT_FIELD }] },
  });
  if (!context) recordAccess.deny();

  const administrator = context.auth.get("role") === "administrator";
  const activeOnly = forceActive || !administrator;
  const resourceId = event.request.pathValue("id");
  let resources;
  if (resourceId) {
    try {
      const resource = $app.findRecordById(RESOURCE_COLLECTION, resourceId);
      if (
        resource.get(TENANT_FIELD) !== context.context.tenant.id ||
        (activeOnly && resource.get("archived") === true)
      ) {
        throw new NotFoundError("resource_not_found");
      }
      resources = [resource];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new NotFoundError("resource_not_found");
    }
  } else {
    const filter = activeOnly ? "tenant = {:tenant} && archived = false" : "tenant = {:tenant}";
    resources = $app.findRecordsByFilter(RESOURCE_COLLECTION, filter, "name_normalized,id", 0, 0, {
      tenant: context.context.tenant.id,
    });
  }
  const items = resources.map((record) =>
    resourceProjection(record, administrator && !forceActive),
  );
  return event.json(200, resourceId ? items[0] : { items });
}

module.exports = { normalizeResource, resourcesProjectionRoute };
