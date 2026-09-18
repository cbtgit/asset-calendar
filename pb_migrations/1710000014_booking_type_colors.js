const BOOKING_TYPE_COLLECTION = "booking_types";
const BOOKING_COLLECTION = "bookings";

migrate(
  (app) => {
    const bookingTypes = app.findCollectionByNameOrId(BOOKING_TYPE_COLLECTION);
    bookingTypes.fields.push(
      new TextField({
        id: "booking_type_color",
        name: "color",
        required: false,
        min: 0,
        max: 7,
      }),
    );
    app.saveNoValidate(bookingTypes);

    const bookings = app.findCollectionByNameOrId(BOOKING_COLLECTION);
    bookings.fields.push(
      new TextField({
        id: "booking_booking_type_color_snapshot",
        name: "booking_type_color_snapshot",
        required: false,
        min: 0,
        max: 7,
      }),
    );
    app.saveNoValidate(bookings);
  },
  () => {},
);
