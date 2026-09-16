const BOOKING_COLLECTION = "bookings";
const TENANT_COLLECTION = "tenants";
const RESOURCE_COLLECTION = "resources";
const USER_COLLECTION = "users";
const BOOKING_TYPE_COLLECTION = "booking_types";

migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId(TENANT_COLLECTION);
    const resources = app.findCollectionByNameOrId(RESOURCE_COLLECTION);
    const users = app.findCollectionByNameOrId(USER_COLLECTION);
    const bookingTypes = app.findCollectionByNameOrId(BOOKING_TYPE_COLLECTION);
    const authenticated = '@request.auth.id != "" && @request.auth.active = true';

    const bookings = new Collection({
      id: BOOKING_COLLECTION,
      name: BOOKING_COLLECTION,
      type: "base",
      fields: [
        {
          id: "booking_tenant",
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
          id: "booking_resource",
          name: "resource",
          type: "relation",
          required: true,
          collectionId: resources.id,
          cascadeDelete: false,
          minSelect: null,
          maxSelect: 1,
          displayFields: ["name"],
        },
        {
          id: "booking_booked_for_user",
          name: "booked_for_user",
          type: "relation",
          required: true,
          collectionId: users.id,
          cascadeDelete: false,
          minSelect: null,
          maxSelect: 1,
          displayFields: ["email"],
        },
        {
          id: "booking_created_by_user",
          name: "created_by_user",
          type: "relation",
          required: true,
          collectionId: users.id,
          cascadeDelete: false,
          minSelect: null,
          maxSelect: 1,
          displayFields: ["email"],
        },
        {
          id: "booking_type",
          name: "booking_type",
          type: "relation",
          required: false,
          collectionId: bookingTypes.id,
          cascadeDelete: false,
          minSelect: null,
          maxSelect: 1,
          displayFields: ["name"],
        },
        {
          id: "booking_start",
          name: "start",
          type: "date",
          required: true,
          min: "",
          max: "",
        },
        {
          id: "booking_end",
          name: "end",
          type: "date",
          required: true,
          min: "",
          max: "",
        },
        {
          id: "booking_resource_base_rate_minor_units",
          name: "resource_base_rate_minor_units",
          type: "number",
          required: false,
          onlyInt: true,
          min: 0,
        },
        {
          id: "booking_type_surcharge_minor_units",
          name: "booking_type_surcharge_minor_units",
          type: "number",
          required: false,
          onlyInt: true,
          min: 0,
        },
        {
          id: "booking_effective_rate_minor_units",
          name: "effective_rate_minor_units",
          type: "number",
          required: false,
          onlyInt: true,
          min: 0,
        },
        {
          id: "booking_booker_display_name_snapshot",
          name: "booker_display_name_snapshot",
          type: "text",
          required: true,
          min: 1,
          max: 201,
        },
        {
          id: "booking_booker_group_snapshot",
          name: "booker_group_snapshot",
          type: "text",
          required: true,
          min: 1,
          max: 200,
        },
        {
          id: "booking_booker_email_snapshot",
          name: "booker_email_snapshot",
          type: "text",
          required: true,
          min: 1,
          max: 320,
        },
        {
          id: "booking_resource_name_snapshot",
          name: "resource_name_snapshot",
          type: "text",
          required: true,
          min: 1,
          max: 200,
        },
        {
          id: "booking_type_name_snapshot",
          name: "booking_type_name_snapshot",
          type: "text",
          required: false,
          min: 0,
          max: 200,
        },
      ],
    });

    bookings.indexes = [
      "CREATE INDEX idx_bookings_tenant_resource_start ON bookings (tenant, resource, start)",
      "CREATE INDEX idx_bookings_tenant_resource_end ON bookings (tenant, resource, end)",
      "CREATE INDEX idx_bookings_tenant_booked_for ON bookings (tenant, booked_for_user)",
    ];

    app.save(bookings);
    bookings.listRule = null;
    bookings.viewRule = null;
    bookings.createRule = null;
    bookings.updateRule = null;
    bookings.deleteRule = null;
    app.saveNoValidate(bookings);
  },
  () => {},
);
