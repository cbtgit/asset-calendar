const TENANT_FIELD = "tenant";
const USER_COLLECTION = "users";
const ORGANIZATIONAL_UNIT_COLLECTION = "organizational_units";

function createGroupAccess({ applicationContext, deny }) {
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
      { tenant: record.get(TENANT_FIELD), group: record.id },
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

  return { normalizeOrganizationalUnit, guardOrganizationalUnitDelete, groupsProjectionRoute };
}

module.exports = { createGroupAccess };
