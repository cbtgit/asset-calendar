const USER_COLLECTION = "_pb_users_auth_";

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId(USER_COLLECTION);
    const invitations = new Collection({
      id: "user_invitations",
      name: "user_invitations",
      type: "base",
      fields: [
        {
          id: "invitation_user",
          name: "user",
          type: "relation",
          required: true,
          collectionId: users.id,
          cascadeDelete: true,
          minSelect: null,
          maxSelect: 1,
          displayFields: ["email"],
        },
        {
          id: "invitation_tenant",
          name: "tenant",
          type: "relation",
          required: true,
          collectionId: "tenants",
          cascadeDelete: false,
          minSelect: null,
          maxSelect: 1,
          displayFields: ["name"],
        },
        {
          id: "invitation_token_hash",
          name: "token_hash",
          type: "text",
          required: true,
          min: 64,
          max: 64,
          pattern: "^[a-f0-9]{64}$",
        },
        {
          id: "invitation_expires_at",
          name: "expires_at",
          type: "date",
          required: true,
          min: "",
          max: "",
        },
        {
          id: "invitation_used_at",
          name: "used_at",
          type: "date",
          required: false,
          min: "",
          max: "",
        },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_user_invitations_token_hash ON user_invitations (token_hash)",
        "CREATE INDEX idx_user_invitations_user ON user_invitations (user)",
      ],
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
    });

    app.save(invitations);
  },
  () => {},
);
