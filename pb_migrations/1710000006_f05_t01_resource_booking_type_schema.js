const TENANT_COLLECTION = "tenants";
const RESOURCE_COLLECTION = "resources";
const BOOKING_TYPE_COLLECTION = "booking_types";
const CURRENCY_VALUES = ["DKK", "EUR", "USD", "GBP"];
const SYSTEM_KIND_VALUES = ["regular", "training", "maintenance", "custom"];
const NAME_PATTERN = "^.*\\S.*$";
const LOCALE_PATTERN = "^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$";
const MAX_SAFE_MINOR_UNITS = Number.MAX_SAFE_INTEGER;

function records(app, collection) {
  return app.findRecordsByFilter(collection, "id != ''", "", 0, 0);
}

function ensureCollectionType(collection, type) {
  if (collection.type !== type) {
    throw new Error(`Collection ${collection.name} must be a ${type} collection.`);
  }
}

function createField(definition) {
  switch (definition.type) {
    case "date":
      return new DateField({ id: definition.id, name: definition.name });
    case "bool":
      return new BoolField({
        id: definition.id,
        name: definition.name,
        required: definition.required === true,
      });
    case "number":
      return new NumberField({
        id: definition.id,
        name: definition.name,
        required: definition.required === true,
        min: definition.min,
        max: definition.max,
        onlyInt: true,
        noDecimal: true,
      });
    case "relation":
      return new RelationField({
        id: definition.id,
        name: definition.name,
        required: definition.required === true,
        collectionId: definition.collectionId,
        cascadeDelete: false,
        maxSelect: 1,
        displayFields: ["name"],
      });
    case "select":
      return new SelectField({
        id: definition.id,
        name: definition.name,
        required: definition.required === true,
        maxSelect: 1,
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
  if (
    definition.type === "select" &&
    JSON.stringify(existing.values ?? []) !== JSON.stringify(definition.values)
  ) {
    throw new Error(
      `Collection ${collection.name} field ${definition.name} has incompatible values.`,
    );
  }
  if (definition.type === "text") {
    existing.min = definition.min;
    existing.max = definition.max;
    existing.pattern = definition.pattern;
  } else if (definition.type === "number") {
    existing.required = definition.required === true;
    existing.min = definition.min;
    existing.max = definition.max;
    existing.onlyInt = true;
    existing.noDecimal = true;
  } else if (definition.required) {
    existing.required = true;
  }
}

function ensureUniqueIndex(collection, index) {
  collection.indexes ??= [];
  const indexName = /INDEX\s+`?([^`\s]+)`?/i.exec(index)?.[1];
  if (
    !collection.indexes.some((existing) =>
      indexName
        ? new RegExp(`INDEX\\s+\`?${indexName}\`?`, "i").test(existing)
        : existing === index,
    )
  ) {
    collection.indexes.push(index);
  }
}

function normalizeNames(existingRecords, label) {
  const normalizedNames = new Map();
  for (const record of existingRecords) {
    const name = record.get("name");
    const tenant = record.get("tenant");
    if (typeof name !== "string" || name.trim() === "") {
      throw new Error(`${label} ${record.id} in tenant ${tenant} has a blank name.`);
    }
    const trimmed = name.trim();
    const normalized = trimmed.toLowerCase();
    const key = `${tenant}\u0000${normalized}`;
    const conflict = normalizedNames.get(key);
    if (conflict) {
      throw new Error(
        `${label} normalization conflict: tenant ${tenant}, records ${conflict} and ${record.id} share normalized name "${normalized}".`,
      );
    }
    normalizedNames.set(key, record.id);
    record.set("name", trimmed);
    record.set("name_normalized", normalized);
  }
}

function createCollection(name, id) {
  return new Collection({
    id,
    name,
    type: "base",
    fields: [],
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  });
}

function lockCollectionRules(collection) {
  collection.listRule = null;
  collection.viewRule = null;
  collection.createRule = null;
  collection.updateRule = null;
  collection.deleteRule = null;
}

function ensureResourceSchema(app, tenants) {
  let resources;
  try {
    resources = app.findCollectionByNameOrId(RESOURCE_COLLECTION);
  } catch {
    resources = createCollection(RESOURCE_COLLECTION, "f05_resources");
  }
  ensureCollectionType(resources, "base");
  ensureField(resources, {
    id: "resource_tenant",
    name: "tenant",
    type: "relation",
    required: true,
    collectionId: tenants.id,
  });
  ensureField(resources, {
    id: "resource_name",
    name: "name",
    type: "text",
    required: true,
    min: 1,
    max: 200,
    pattern: NAME_PATTERN,
  });
  ensureField(resources, {
    id: "resource_name_normalized",
    name: "name_normalized",
    type: "text",
    required: true,
    min: 1,
    max: 200,
    pattern: NAME_PATTERN,
  });
  ensureField(resources, {
    id: "resource_base_rate_minor_units",
    name: "base_rate_minor_units",
    type: "number",
    required: true,
    min: 0,
    max: MAX_SAFE_MINOR_UNITS,
  });
  ensureField(resources, { id: "resource_archived", name: "archived", type: "bool" });
  ensureField(resources, { id: "resource_archived_at", name: "archived_at", type: "date" });
  resources.fields.find((field) => field.name === "name_normalized").hidden = true;
  lockCollectionRules(resources);
  app.save(resources);
  return resources;
}

function ensureBookingTypeSchema(app, tenants) {
  let bookingTypes;
  try {
    bookingTypes = app.findCollectionByNameOrId(BOOKING_TYPE_COLLECTION);
  } catch {
    bookingTypes = createCollection(BOOKING_TYPE_COLLECTION, "f05_booking_types");
  }
  ensureCollectionType(bookingTypes, "base");
  ensureField(bookingTypes, {
    id: "booking_type_tenant",
    name: "tenant",
    type: "relation",
    required: true,
    collectionId: tenants.id,
  });
  ensureField(bookingTypes, {
    id: "booking_type_name",
    name: "name",
    type: "text",
    required: true,
    min: 1,
    max: 200,
    pattern: NAME_PATTERN,
  });
  ensureField(bookingTypes, {
    id: "booking_type_name_normalized",
    name: "name_normalized",
    type: "text",
    required: true,
    min: 1,
    max: 200,
    pattern: NAME_PATTERN,
  });
  ensureField(bookingTypes, {
    id: "booking_type_surcharge_minor_units",
    name: "surcharge_minor_units",
    type: "number",
    required: true,
    min: 0,
    max: MAX_SAFE_MINOR_UNITS,
  });
  ensureField(bookingTypes, {
    id: "booking_type_system_kind",
    name: "system_kind",
    type: "select",
    required: true,
    values: SYSTEM_KIND_VALUES,
  });
  ensureField(bookingTypes, { id: "booking_type_billable", name: "billable", type: "bool" });
  ensureField(bookingTypes, {
    id: "booking_type_resource_blocking",
    name: "resource_blocking",
    type: "bool",
  });
  ensureField(bookingTypes, { id: "booking_type_archived", name: "archived", type: "bool" });
  ensureField(bookingTypes, { id: "booking_type_archived_at", name: "archived_at", type: "date" });
  bookingTypes.fields.find((field) => field.name === "name_normalized").hidden = true;
  lockCollectionRules(bookingTypes);
  app.save(bookingTypes);
  return bookingTypes;
}

function seedBookingTypes(app, collection, tenant) {
  const existing = records(app, collection).filter((record) => record.get("tenant") === tenant.id);
  const definitions = [
    { kind: "regular", name: "Regular", surcharge: 0, billable: true, blocking: true },
    { kind: "training", name: "Training", surcharge: 0, billable: true, blocking: true },
    { kind: "maintenance", name: "Maintenance", surcharge: 0, billable: false, blocking: true },
  ];
  for (const definition of definitions) {
    if (existing.some((record) => record.get("system_kind") === definition.kind)) continue;
    const record = new Record(collection);
    record.set("tenant", tenant.id);
    record.set("name", definition.name);
    record.set("name_normalized", definition.name.toLowerCase());
    record.set("surcharge_minor_units", String(definition.surcharge));
    record.set("system_kind", definition.kind);
    record.set("billable", definition.billable);
    record.set("resource_blocking", definition.blocking);
    record.set("archived", false);
    app.saveNoValidate(record);
  }
}

migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId(TENANT_COLLECTION);
    ensureCollectionType(tenants, "base");
    ensureField(tenants, {
      id: "tenant_currency",
      name: "currency",
      type: "select",
      required: true,
      values: CURRENCY_VALUES,
    });
    ensureField(tenants, {
      id: "tenant_locale",
      name: "locale",
      type: "text",
      required: true,
      min: 2,
      max: 35,
      pattern: LOCALE_PATTERN,
    });
    app.saveNoValidate(tenants);
    for (const tenant of records(app, tenants)) {
      if (!tenant.get("currency")) tenant.set("currency", "DKK");
      if (!tenant.get("locale")) tenant.set("locale", "da-DK");
      app.save(tenant);
    }
    const resources = ensureResourceSchema(app, tenants);
    const existingResources = records(app, resources);
    normalizeNames(existingResources, "Resource");
    for (const record of existingResources) app.save(record);
    ensureUniqueIndex(
      resources,
      "CREATE UNIQUE INDEX idx_resources_tenant_name_normalized ON resources (tenant, name_normalized)",
    );
    app.save(resources);

    const bookingTypes = ensureBookingTypeSchema(app, tenants);
    const existingBookingTypes = records(app, bookingTypes);
    normalizeNames(existingBookingTypes, "Booking type");
    for (const record of existingBookingTypes) app.save(record);
    ensureUniqueIndex(
      bookingTypes,
      "CREATE UNIQUE INDEX idx_booking_types_tenant_name_normalized ON booking_types (tenant, name_normalized)",
    );
    app.save(bookingTypes);
    for (const tenant of records(app, tenants)) seedBookingTypes(app, bookingTypes, tenant);
  },
  () => {},
);
