const TENANT_COLLECTION = "tenants";
const SETTINGS_COLLECTION = "tenant_settings";

function ensureUniqueIndex(collection, index) {
  collection.indexes ??= [];
  const indexName = /INDEX\s+`?([^`\s]+)`?/i.exec(index)?.[1];
  const exists = indexName
    ? collection.indexes.some((existing) =>
        new RegExp("INDEX\\s+`?" + indexName + "`?", "i").test(existing),
      )
    : collection.indexes.includes(index);
  if (!exists) collection.indexes.push(index);
}

function existingRecord(app, tenantId) {
  try {
    return app.findFirstRecordByData(SETTINGS_COLLECTION, "tenant", tenantId);
  } catch {
    return null;
  }
}

function backfillSettings(app, settings, tenants) {
  for (const tenant of tenants) {
    const existing = existingRecord(app, tenant.id);
    const record = existing ?? new Record(settings);
    record.set("tenant", tenant.id);
    if (!record.get("locale")) record.set("locale", "da-DK");
    if (!record.get("currency_code")) record.set("currency_code", "DKK");
    if (!record.get("timezone")) record.set("timezone", "Europe/Copenhagen");
    if (
      !existing ||
      record.get("booking_edit_lead_hours") === undefined ||
      record.get("booking_edit_lead_hours") === null
    ) {
      record.set("booking_edit_lead_hours", 24);
    }
    if (!record.get("heading_title")) record.set("heading_title", "Asset Calendar");
    app.save(record);
  }
}

migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId(TENANT_COLLECTION);
    let settings;
    try {
      settings = app.findCollectionByNameOrId(SETTINGS_COLLECTION);
    } catch {
      settings = new Collection({
        id: SETTINGS_COLLECTION,
        name: SETTINGS_COLLECTION,
        type: "base",
        fields: [
          {
            id: "tenant_settings_tenant",
            name: "tenant",
            type: "relation",
            required: true,
            collectionId: tenants.id,
            cascadeDelete: false,
            minSelect: null,
            maxSelect: 1,
            displayFields: ["name"],
          },
          {
            id: "tenant_settings_locale",
            name: "locale",
            type: "text",
            required: true,
            min: 1,
            max: 35,
            pattern: "^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$",
            default: "da-DK",
          },
          {
            id: "tenant_settings_currency_code",
            name: "currency_code",
            type: "select",
            required: true,
            maxSelect: 1,
            values: ["DKK", "EUR", "USD", "GBP"],
            default: "DKK",
          },
          {
            id: "tenant_settings_timezone",
            name: "timezone",
            type: "select",
            required: true,
            maxSelect: 1,
            values: [
              "Europe/Copenhagen",
              "Europe/London",
              "Europe/Berlin",
              "Europe/Paris",
              "America/New_York",
              "America/Chicago",
              "America/Los_Angeles",
              "UTC",
            ],
            default: "Europe/Copenhagen",
          },
          {
            id: "tenant_settings_booking_edit_lead_hours",
            name: "booking_edit_lead_hours",
            type: "number",
            required: true,
            onlyInt: true,
            min: 0,
            default: 24,
          },
          {
            id: "tenant_settings_heading_title",
            name: "heading_title",
            type: "text",
            required: true,
            min: 1,
            max: 200,
            pattern: "^.*\\S.*$",
            default: "Asset Calendar",
          },
        ],
      });
    }

    ensureUniqueIndex(
      settings,
      "CREATE UNIQUE INDEX idx_tenant_settings_tenant ON tenant_settings (tenant)",
    );
    app.save(settings);

    const administrator =
      '@request.auth.id != "" && @request.auth.active = true && @request.auth.role = "administrator"';
    const sameTenant = "@request.auth.tenant = tenant";
    settings.listRule = `${administrator} && ${sameTenant}`;
    settings.viewRule = `${administrator} && ${sameTenant}`;
    settings.updateRule = `${administrator} && ${sameTenant} && @request.body.tenant:changed = false`;
    settings.createRule = null;
    settings.deleteRule = null;
    app.saveNoValidate(settings);

    backfillSettings(
      app,
      settings,
      app.findRecordsByFilter(TENANT_COLLECTION, "id != ''", "", 0, 0),
    );
  },
  () => {},
);
