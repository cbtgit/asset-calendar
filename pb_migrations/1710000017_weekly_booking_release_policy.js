migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.add(
      new SelectField({
        id: "user_booking_access",
        name: "booking_access",
        required: false,
        maxSelect: 1,
        values: ["priority"],
      }),
    );
    app.save(users);

    const resources = app.findCollectionByNameOrId("resources");
    resources.fields.add(
      new BoolField({
        id: "resource_priority_booking_enabled",
        name: "priority_booking_enabled",
      }),
      new NumberField({
        id: "resource_public_booking_release_weekday",
        name: "public_booking_release_weekday",
        onlyInt: true,
        min: 1,
        max: 7,
      }),
      new TextField({
        id: "resource_public_booking_release_time",
        name: "public_booking_release_time",
        required: false,
        min: 5,
        max: 5,
      }),
    );
    app.saveNoValidate(resources);

    for (const resource of app.findRecordsByFilter(resources, "id != ''", "", 0, 0)) {
      resource.set("priority_booking_enabled", false);
      resource.set("public_booking_release_weekday", 3);
      resource.set("public_booking_release_time", "10:00");
      app.saveNoValidate(resource);
    }

    const tenantSettings = app.findCollectionByNameOrId("tenant_settings");
    tenantSettings.fields.add(
      new TextField({
        id: "tenant_settings_time_zone",
        name: "time_zone",
        required: false,
        min: 1,
        max: 100,
      }),
    );
    app.saveNoValidate(tenantSettings);

    for (const settings of app.findRecordsByFilter(tenantSettings, "id != ''", "", 0, 0)) {
      settings.set("time_zone", "Europe/Copenhagen");
      app.saveNoValidate(settings);
    }
  },
  () => {},
);
