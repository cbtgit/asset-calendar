const ORGANIZATIONAL_UNIT_COLLECTION = "organizational_units";

function normalizeName(name) {
  return name.trim().toLowerCase();
}

function records(app, collection) {
  return app.findRecordsByFilter(collection, "id != ''", "", 0, 0);
}

function ensureField(collection, definition) {
  const existing = collection.fields.find((field) => field.name === definition.name);
  if (!existing) {
    collection.fields.push(
      new TextField({
        id: definition.id,
        name: definition.name,
        required: definition.required === true,
        min: definition.min,
        max: definition.max,
        pattern: definition.pattern,
      }),
    );
    return collection.fields.at(-1);
  }
  return existing;
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

migrate(
  (app) => {
    const organizationalUnits = app.findCollectionByNameOrId(ORGANIZATIONAL_UNIT_COLLECTION);
    const existingRecords = records(app, organizationalUnits);
    const normalizedNames = new Map();

    for (const record of existingRecords) {
      const name = record.get("name");
      const tenant = record.get("tenant");
      if (typeof name !== "string" || name.trim() === "") {
        throw new Error(
          `Organizational unit ${record.id} in tenant ${tenant} has a blank name and cannot be normalized.`,
        );
      }
      const normalized = normalizeName(name);
      const key = `${tenant}\u0000${normalized}`;
      const conflict = normalizedNames.get(key);
      if (conflict) {
        throw new Error(
          `Organizational unit normalization conflict: tenant ${tenant}, records ${conflict} and ${record.id} share normalized name "${normalized}".`,
        );
      }
      normalizedNames.set(key, record.id);
      record.set("name_normalized", normalized);
    }

    const nameField = organizationalUnits.fields.find((field) => field.name === "name");
    if (nameField) {
      nameField.min = 1;
      nameField.max = 200;
      nameField.pattern = "^.*\\S.*$";
    }
    const normalizedField = ensureField(organizationalUnits, {
      id: "organizational_unit_name_normalized",
      name: "name_normalized",
      required: true,
      min: 1,
      max: 200,
      pattern: "^.*\\S.*$",
    });
    normalizedField.hidden = true;
    ensureUniqueIndex(
      organizationalUnits,
      "CREATE UNIQUE INDEX idx_organizational_units_tenant_name_normalized ON organizational_units (tenant, name_normalized)",
    );
    organizationalUnits.listRule =
      '@request.auth.id != "" && @request.auth.active = true && @request.auth.role = "administrator" && @request.auth.tenant = tenant';
    organizationalUnits.viewRule = organizationalUnits.listRule;
    organizationalUnits.createRule =
      '@request.auth.id != "" && @request.auth.active = true && @request.auth.role = "administrator"';
    organizationalUnits.updateRule =
      '@request.auth.id != "" && @request.auth.active = true && @request.auth.role = "administrator" && @request.auth.tenant = tenant';
    organizationalUnits.deleteRule = organizationalUnits.updateRule;
    app.saveNoValidate(organizationalUnits);

    for (const record of existingRecords) {
      app.save(record);
    }
  },
  () => {},
);
