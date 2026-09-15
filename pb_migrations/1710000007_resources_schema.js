const RESOURCE_COLLECTION = "resources";
const TENANT_COLLECTION = "tenants";

migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId(TENANT_COLLECTION);
    const authenticated = '@request.auth.id != "" && @request.auth.active = true';
    const administrator = `${authenticated} && @request.auth.role = "administrator"`;
    const sameTenant = "@request.auth.tenant = tenant";

    const resources = new Collection({
      id: RESOURCE_COLLECTION,
      name: RESOURCE_COLLECTION,
      type: "base",
      fields: [
        {
          id: "resource_tenant",
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
          id: "resource_name",
          name: "name",
          type: "text",
          required: true,
          min: 1,
          max: 200,
          pattern: "^.*\\S.*$",
        },
        {
          id: "resource_name_normalized",
          name: "name_normalized",
          type: "text",
          required: true,
          min: 1,
          max: 200,
          pattern: "^.*\\S.*$",
          hidden: true,
        },
        {
          id: "resource_base_rate_minor_units",
          name: "base_rate_minor_units",
          type: "number",
          required: false,
          onlyInt: true,
          min: 0,
        },
        {
          id: "resource_archived_at",
          name: "archived_at",
          type: "date",
          required: false,
          min: "",
          max: "",
        },
      ],
    });

    resources.indexes = [
      "CREATE UNIQUE INDEX idx_resources_tenant_name_normalized ON resources (tenant, name_normalized)",
    ];

    app.save(resources);
    resources.listRule = `${authenticated} && ${sameTenant}`;
    resources.viewRule = `${authenticated} && ${sameTenant}`;
    resources.createRule = administrator;
    resources.updateRule = `${administrator} && ${sameTenant} && @request.body.tenant:changed = false`;
    resources.deleteRule = null;
    app.saveNoValidate(resources);
  },
  () => {},
);
