const TENANT_COLLECTION = "tenants";
const TENANT_SETTINGS_COLLECTION = "tenant_settings";
const DEFAULT_SITE_TITLE = "Asset Calendar";
const DEFAULT_BOOKING_LOCK_HOURS = 24;

migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId(TENANT_COLLECTION);
    let tenantSettings;
    try {
      tenantSettings = app.findCollectionByNameOrId(TENANT_SETTINGS_COLLECTION);
    } catch {
      tenantSettings = new Collection({
        id: TENANT_SETTINGS_COLLECTION,
        name: TENANT_SETTINGS_COLLECTION,
        type: "base",
        fields: [
          {
            id: "tenant_settings_tenant",
            name: "tenant",
            type: "relation",
            required: true,
            collectionId: tenants.id,
            cascadeDelete: true,
            minSelect: null,
            maxSelect: 1,
            displayFields: ["name"],
          },
          {
            id: "tenant_settings_site_title",
            name: "site_title",
            type: "text",
            required: true,
            min: 1,
            max: 200,
            pattern: "^.*\\S.*$",
          },
          {
            id: "tenant_settings_booking_lock_hours",
            name: "booking_lock_hours",
            type: "number",
            required: false,
            onlyInt: true,
            min: 0,
          },
        ],
      });
    }

    tenantSettings.indexes = [
      "CREATE UNIQUE INDEX idx_tenant_settings_tenant ON tenant_settings (tenant)",
    ];
    app.save(tenantSettings);

    const authenticated = '@request.auth.id != "" && @request.auth.active = true';
    const administrator = `${authenticated} && @request.auth.role = "administrator"`;
    const sameTenant = "@request.auth.tenant = tenant";
    tenantSettings.listRule = `${authenticated} && ${sameTenant}`;
    tenantSettings.viewRule = `${authenticated} && ${sameTenant}`;
    tenantSettings.createRule = null;
    tenantSettings.updateRule = `${administrator} && ${sameTenant} && @request.body.tenant:changed = false`;
    tenantSettings.deleteRule = null;
    app.saveNoValidate(tenantSettings);

    const existingTenants = app.findRecordsByFilter(tenants, "id != ''", "", 0, 0);
    for (const tenant of existingTenants) {
      let settings;
      try {
        settings = app.findFirstRecordByData(tenantSettings, "tenant", tenant.id);
      } catch {
        settings = new Record(tenantSettings);
        settings.set("tenant", tenant.id);
        settings.set("site_title", DEFAULT_SITE_TITLE);
        settings.set("booking_lock_hours", DEFAULT_BOOKING_LOCK_HOURS);
        app.save(settings);
      }
    }
  },
  () => {},
);
