const TENANT_COLLECTION = "tenants";
const ORGANIZATIONAL_UNIT_COLLECTION = "organizational_units";
const USER_COLLECTION = "_pb_users_auth_";

function findCollection(app, ...ids) {
  for (const id of ids) {
    try {
      return app.findCollectionByNameOrId(id);
    } catch {
      // Try the next compatible name or id.
    }
  }
  return null;
}

function ensureCollectionType(collection, type) {
  if (collection.type !== type) {
    throw new Error(`Collection ${collection.name} must be a ${type} collection.`);
  }
}

function createField(definition) {
  switch (definition.type) {
    case "bool":
      return new BoolField({
        id: definition.id,
        name: definition.name,
        required: definition.required === true,
      });
    case "relation":
      return new RelationField({
        id: definition.id,
        name: definition.name,
        required: definition.required === true,
        collectionId: definition.collectionId,
        cascadeDelete: definition.cascadeDelete === true,
        minSelect: definition.minSelect,
        maxSelect: definition.maxSelect,
      });
    case "select":
      return new SelectField({
        id: definition.id,
        name: definition.name,
        required: definition.required === true,
        maxSelect: definition.maxSelect,
        values: definition.values,
      });
    case "text":
      return new TextField({
        id: definition.id,
        name: definition.name,
        required: definition.required === true,
        min: definition.min,
        max: definition.max,
        pattern: definition.pattern,
      });
    default:
      throw new Error(`Unsupported field type: ${definition.type}.`);
  }
}

function ensureField(collection, definition) {
  const existing = collection.fields.find((field) => field.name === definition.name);
  if (!existing) {
    collection.fields.push(createField(definition));
    return;
  }

  const existingType = typeof existing.type === "function" ? existing.type() : existing.type;
  if (existingType !== definition.type) {
    throw new Error(
      `Collection ${collection.name} field ${definition.name} has incompatible type ${existingType}.`,
    );
  }

  if (definition.type === "relation" && existing.collectionId !== definition.collectionId) {
    throw new Error(
      `Collection ${collection.name} field ${definition.name} targets the wrong collection.`,
    );
  }

  if (
    definition.type === "select" &&
    JSON.stringify(existing.values ?? []) !== JSON.stringify(definition.values)
  ) {
    throw new Error(
      `Collection ${collection.name} field ${definition.name} has incompatible values.`,
    );
  }

  if (definition.type === "bool") {
    existing.required = false;
  } else if (definition.required) {
    existing.required = true;
  }
}

function ensureUniqueIndex(collection, index) {
  collection.indexes ??= [];
  const indexName = /INDEX\s+`?([^`\s]+)`?/i.exec(index)?.[1];
  const exists = indexName
    ? collection.indexes.some((existing) =>
        new RegExp(`INDEX\\s+\`?${indexName}\`?`, "i").test(existing),
      )
    : collection.indexes.includes(index);
  if (!exists) collection.indexes.push(index);
}

function records(app, collection) {
  return app.findRecordsByFilter(collection, "id != ''", "", 0, 0);
}

function isMissing(value) {
  return value === undefined || value === null || value === "";
}

function reconcileExistingRecords(app, collection, existingRecords, values) {
  for (const record of existingRecords) {
    let changed = false;
    for (const [name, value] of Object.entries(values(record))) {
      if (isMissing(record.get(name))) {
        record.set(name, value);
        changed = true;
      }
    }
    if (changed) app.save(record);
  }
}

migrate(
  (app) => {
    let tenants = findCollection(app, TENANT_COLLECTION);
    const existingTenants = tenants ? records(app, tenants) : [];
    if (!tenants) {
      tenants = new Collection({
        id: TENANT_COLLECTION,
        name: TENANT_COLLECTION,
        type: "base",
        fields: [],
        listRule: "",
        viewRule: "",
        createRule: "",
        updateRule: "",
        deleteRule: "",
      });
    }
    ensureCollectionType(tenants, "base");
    ensureField(tenants, {
      id: "tenant_name",
      name: "name",
      type: "text",
      required: true,
      min: 1,
      max: 200,
      pattern: "",
    });
    ensureField(tenants, {
      id: "tenant_subdomain",
      name: "subdomain",
      type: "text",
      required: true,
      min: 1,
      max: 63,
      pattern: "^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$",
    });
    ensureUniqueIndex(tenants, "CREATE UNIQUE INDEX idx_tenants_subdomain ON tenants (subdomain)");
    app.save(tenants);
    reconcileExistingRecords(app, tenants, existingTenants, (record) => {
      if (isMissing(record.get("name")) || isMissing(record.get("subdomain"))) {
        throw new Error(`Tenant ${record.id} requires a name and subdomain before migration.`);
      }
      return {};
    });

    let organizationalUnits = findCollection(app, ORGANIZATIONAL_UNIT_COLLECTION);
    const existingOrganizationalUnits = organizationalUnits
      ? records(app, organizationalUnits)
      : [];
    if (!organizationalUnits) {
      organizationalUnits = new Collection({
        id: ORGANIZATIONAL_UNIT_COLLECTION,
        name: ORGANIZATIONAL_UNIT_COLLECTION,
        type: "base",
        fields: [],
        listRule: "",
        viewRule: "",
        createRule: "",
        updateRule: "",
        deleteRule: "",
      });
    }
    ensureCollectionType(organizationalUnits, "base");
    ensureField(organizationalUnits, {
      id: "organizational_unit_tenant",
      name: "tenant",
      type: "relation",
      required: true,
      collectionId: tenants.id,
      cascadeDelete: false,
      minSelect: null,
      maxSelect: 1,
      displayFields: ["name"],
    });
    ensureField(organizationalUnits, {
      id: "organizational_unit_name",
      name: "name",
      type: "text",
      required: true,
      min: 1,
      max: 200,
      pattern: "",
    });
    ensureUniqueIndex(
      organizationalUnits,
      "CREATE UNIQUE INDEX idx_organizational_units_tenant_name ON organizational_units (tenant, name)",
    );
    app.save(organizationalUnits);
    reconcileExistingRecords(app, organizationalUnits, existingOrganizationalUnits, (record) => {
      const tenantIds = records(app, tenants).map((tenant) => tenant.id);
      if (isMissing(record.get("tenant")) && tenantIds.length === 1) {
        return { tenant: tenantIds[0] };
      }
      if (isMissing(record.get("tenant")) || isMissing(record.get("name"))) {
        throw new Error(
          `Organizational unit ${record.id} cannot be reconciled without a tenant and name.`,
        );
      }
      return {};
    });

    let users = findCollection(app, USER_COLLECTION, "users");
    if (!users) {
      users = new Collection({
        id: USER_COLLECTION,
        name: "users",
        type: "auth",
        fields: [],
        listRule: "",
        viewRule: "",
        createRule: "",
        updateRule: "",
        deleteRule: "",
      });
    }
    ensureCollectionType(users, "auth");
    const existingUsers = records(app, users);
    const tenantIds = records(app, tenants).map((tenant) => tenant.id);
    const organizationalUnitIds = records(app, organizationalUnits).map((unit) => unit.id);

    ensureField(users, {
      id: "user_tenant",
      name: "tenant",
      type: "relation",
      required: true,
      collectionId: tenants.id,
      cascadeDelete: false,
      minSelect: null,
      maxSelect: 1,
      displayFields: ["name"],
    });
    ensureField(users, {
      id: "user_first_name",
      name: "first_name",
      type: "text",
      min: 0,
      max: 100,
      pattern: "",
    });
    ensureField(users, {
      id: "user_last_name",
      name: "last_name",
      type: "text",
      min: 0,
      max: 100,
      pattern: "",
    });
    ensureField(users, {
      id: "user_role",
      name: "role",
      type: "select",
      required: true,
      maxSelect: 1,
      values: ["administrator", "regular"],
    });
    ensureField(users, {
      id: "user_active",
      name: "active",
      type: "bool",
    });
    ensureField(users, {
      id: "user_organizational_unit",
      name: "organizational_unit",
      type: "relation",
      required: true,
      collectionId: organizationalUnits.id,
      cascadeDelete: false,
      minSelect: null,
      maxSelect: 1,
      displayFields: ["name"],
    });
    ensureField(users, {
      id: "user_password_setup_pending",
      name: "password_setup_pending",
      type: "bool",
    });
    app.save(users);

    reconcileExistingRecords(app, users, existingUsers, (record) => {
      const values = {};
      if (isMissing(record.get("tenant"))) {
        if (tenantIds.length !== 1) {
          throw new Error(`User ${record.id} cannot be reconciled without exactly one tenant.`);
        }
        values.tenant = tenantIds[0];
      }
      if (isMissing(record.get("organizational_unit"))) {
        if (organizationalUnitIds.length !== 1) {
          throw new Error(
            `User ${record.id} cannot be reconciled without exactly one organizational unit.`,
          );
        }
        values.organizational_unit = organizationalUnitIds[0];
      }
      if (isMissing(record.get("first_name"))) values.first_name = "";
      if (isMissing(record.get("last_name"))) values.last_name = "";
      if (isMissing(record.get("role"))) {
        values.role = existingUsers.length === 1 ? "administrator" : "regular";
      }
      if (isMissing(record.get("active"))) values.active = true;
      if (isMissing(record.get("password_setup_pending"))) {
        values.password_setup_pending = false;
      }
      return values;
    });
  },
  () => {},
);
