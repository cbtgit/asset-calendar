const USER_COLLECTION = "_pb_users_auth_";

function ensureUniqueIndex(collection, index) {
  collection.indexes ??= [];
  const indexName = /INDEX\s+`?([^`\s]+)`?/i.exec(index)?.[1];
  const exists = indexName
    ? collection.indexes.some((existing) =>
        new RegExp(`INDEX\\s+\`?${indexName}\`?`, "i").test(existing),
      )
    : collection.indexes.includes(index);
  if (!exists) collection.indexes.push(index);
}

function ensureEmailNormalizedField(collection) {
  const existing = collection.fields.find((field) => field.name === "email_normalized");
  if (existing) return existing;

  const field = new TextField({
    id: "user_email_normalized",
    name: "email_normalized",
    required: true,
    min: 1,
    max: 320,
    pattern: "^\\S+@\\S+$",
  });
  field.hidden = true;
  collection.fields.push(field);
  return field;
}

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId(USER_COLLECTION);
    const existingUsers = app.findRecordsByFilter(users, "id != ''", "", 0, 0);
    const normalizedEmails = new Map();

    for (const user of existingUsers) {
      const email = user.get("email");
      if (typeof email !== "string" || email.trim() === "") {
        throw new Error(`User ${user.id} has no email and cannot be normalized.`);
      }
      const normalized = email.trim().toLowerCase();
      const conflict = normalizedEmails.get(normalized);
      if (conflict && conflict !== user.id) {
        throw new Error(
          `User email normalization conflict: records ${conflict} and ${user.id} share normalized email "${normalized}".`,
        );
      }
      normalizedEmails.set(normalized, user.id);
      user.set("email_normalized", normalized);
    }

    const emailField = ensureEmailNormalizedField(users);
    emailField.hidden = true;
    emailField.required = false;
    app.saveNoValidate(users);

    for (const user of existingUsers) app.save(user);

    emailField.required = true;
    ensureUniqueIndex(
      users,
      "CREATE UNIQUE INDEX idx_users_email_normalized ON users (email_normalized)",
    );
    app.saveNoValidate(users);
  },
  () => {},
);
