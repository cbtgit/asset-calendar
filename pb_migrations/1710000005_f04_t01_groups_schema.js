const ORGANIZATIONAL_UNIT_COLLECTION = "organizational_units";

function normalizeName(name) {
  return name.trim().toLowerCase();
}

function records(app, collection) {
  return app.findRecordsByFilter(collection, "id != ''", "", 0, 0);
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

    const tenantField = organizationalUnits.fields.find((field) => field.name === "tenant");
    if (tenantField) tenantField.hidden = false;
    const nameField = organizationalUnits.fields.find((field) => field.name === "name");
    if (nameField) {
      nameField.min = 1;
      nameField.max = 200;
      nameField.pattern = "^.*\\S.*$";
    }
    const fieldFactory = new Collection({
      id: "f04_t01_field_factory",
      name: "f04_t01_field_factory",
      type: "base",
      fields: [
        {
          id: "organizational_unit_name_normalized",
          name: "name_normalized",
          type: "text",
          required: true,
          min: 1,
          max: 200,
          pattern: "^.*\\S.*$",
          hidden: true,
        },
      ],
    });
    const normalizedField = fieldFactory.fields.find((field) => field.name === "name_normalized");
    organizationalUnits.fields.push(normalizedField);
    organizationalUnits.indexes.push(
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
