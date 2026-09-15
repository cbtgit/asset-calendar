const BOOKING_TYPE_COLLECTION = "booking_types";
const TENANT_COLLECTION = "tenants";

migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId(TENANT_COLLECTION);
    const normalizedNameField = {
      id: "booking_type_name_normalized",
      name: "name_normalized",
      type: "text",
      required: true,
      min: 1,
      max: 200,
      pattern: "^.*\\S.*$",
      hidden: true,
    };

    const administrator =
      '@request.auth.id != "" && @request.auth.active = true && @request.auth.role = "administrator"';

    const sameTenant = "@request.auth.tenant = tenant";

    const bookingTypes = new Collection({
      id: BOOKING_TYPE_COLLECTION,
      name: BOOKING_TYPE_COLLECTION,
      type: "base",
      fields: [
        {
          id: "booking_type_tenant",
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
          id: "booking_type_name",
          name: "name",
          type: "text",
          required: true,
          min: 1,
          max: 200,
          pattern: "^.*\\S.*$",
        },
        normalizedNameField,
        {
          id: "booking_type_surcharge_minor_units",
          name: "surcharge_minor_units",
          type: "number",
          required: false,
          onlyInt: true,
          min: 0,
        },
        {
          id: "booking_type_archived_at",
          name: "archived_at",
          type: "date",
          required: false,
          min: "",
          max: "",
        },
      ],
    });

    bookingTypes.indexes = [
      "CREATE UNIQUE INDEX idx_booking_types_tenant_name_normalized ON booking_types (tenant, name_normalized)",
    ];

    app.save(bookingTypes);
    bookingTypes.listRule = `${administrator} && ${sameTenant}`;
    bookingTypes.viewRule = `${administrator} && ${sameTenant}`;
    bookingTypes.createRule = `${administrator} && @request.body.tenant = @request.auth.tenant`;
    bookingTypes.updateRule = `${administrator} && ${sameTenant} && @request.body.tenant:changed = false`;
    bookingTypes.deleteRule = null;
    app.saveNoValidate(bookingTypes);
  },
  () => {},
);
