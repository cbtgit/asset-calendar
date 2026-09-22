const BOOKING_TYPE_COLLECTION = "booking_types";

migrate(
  (app) => {
    const bookingTypes = app.findCollectionByNameOrId(BOOKING_TYPE_COLLECTION);
    bookingTypes.createRule =
      '@request.auth.id != "" && @request.auth.active = true && @request.auth.role = "administrator"';
    app.saveNoValidate(bookingTypes);
  },
  () => {},
);
