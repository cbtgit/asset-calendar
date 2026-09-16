const BOOKING_TYPE_COLLECTION = "booking_types";

migrate(
  (app) => {
    const bookingTypes = app.findCollectionByNameOrId(BOOKING_TYPE_COLLECTION);
    bookingTypes.fields.push(
      new BoolField({
        id: "booking_type_nonbillable",
        name: "nonbillable",
        required: false,
      }),
    );
    app.saveNoValidate(bookingTypes);
  },
  () => {},
);
