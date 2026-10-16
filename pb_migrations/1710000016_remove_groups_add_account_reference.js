migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.indexes = users.indexes.filter(
      (index) => !index.includes("idx_users_tenant_organizational_unit"),
    );
    users.fields.removeByName("organizational_unit");
    users.fields.add(
      new TextField({
        id: "user_account_reference_number",
        name: "account_reference_number",
        required: false,
        min: 0,
        max: 200,
      }),
    );
    app.save(users);

    const bookings = app.findCollectionByNameOrId("bookings");
    bookings.fields.removeByName("booker_group_snapshot");
    bookings.fields.add(
      new TextField({
        id: "booking_account_reference_number_snapshot",
        name: "account_reference_number_snapshot",
        required: false,
        min: 0,
        max: 200,
      }),
    );
    app.saveNoValidate(bookings);

    app.delete(app.findCollectionByNameOrId("organizational_units"));
  },
  () => {},
);
