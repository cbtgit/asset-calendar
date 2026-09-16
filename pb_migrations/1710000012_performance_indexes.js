const USER_COLLECTION = "_pb_users_auth_";
const BOOKING_COLLECTION = "bookings";

function ensureIndex(collection, index) {
  collection.indexes ??= [];
  const indexName = /INDEX\s+`?([^`\s]+)`?/i.exec(index)?.[1];
  if (
    !collection.indexes.some((existing) => {
      if (!indexName) return existing === index;
      return new RegExp(`INDEX\\s+${indexName}\\b`, "i").test(existing.replaceAll("`", ""));
    })
  ) {
    collection.indexes.push(index);
  }
}

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId(USER_COLLECTION);
    ensureIndex(
      users,
      "CREATE INDEX idx_users_tenant_organizational_unit ON users (tenant, organizational_unit)",
    );
    app.saveNoValidate(users);

    const bookings = app.findCollectionByNameOrId(BOOKING_COLLECTION);
    ensureIndex(bookings, "CREATE INDEX idx_bookings_tenant_start ON bookings (tenant, start, id)");
    app.saveNoValidate(bookings);
  },
  () => {},
);
