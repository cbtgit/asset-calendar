migrate(
  (app) => {
    const users = new Collection({
      id: "typegen_users",
      name: "typegen_users",
      type: "auth",
      fields: [
        {
          id: "displayname",
          name: "displayName",
          type: "text",
          required: true,
          min: 1,
          max: 100,
          pattern: "",
        },
      ],
      listRule: "",
      viewRule: "",
      createRule: "",
      updateRule: "",
      deleteRule: "",
    });
    const records = new Collection({
      id: "typegen_records",
      name: "typegen_records",
      type: "base",
      fields: [
        {
          id: "title",
          name: "title",
          type: "text",
          required: true,
          min: 1,
          max: 200,
          pattern: "",
        },
        {
          id: "amount",
          name: "amount",
          type: "number",
          required: true,
          min: 0,
          max: null,
          noDecimal: false,
        },
        { id: "active", name: "active", type: "bool" },
        {
          id: "when",
          name: "when",
          type: "date",
          min: "",
          max: "",
        },
        {
          id: "kind",
          name: "kind",
          type: "select",
          required: true,
          maxSelect: 1,
          values: ["one", "two"],
        },
        { id: "metadata", name: "metadata", type: "json" },
        {
          id: "attachment",
          name: "attachment",
          type: "file",
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ["image/png"],
          thumbs: [],
        },
        {
          id: "owner",
          name: "owner",
          type: "relation",
          required: true,
          collectionId: "typegen_users",
          cascadeDelete: true,
          minSelect: null,
          maxSelect: 1,
          displayFields: ["displayName"],
        },
      ],
      listRule: "",
      viewRule: "",
      createRule: "",
      updateRule: "",
      deleteRule: "",
    });

    app.save(users);
    return app.save(records);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("typegen_records"));
    return app.delete(app.findCollectionByNameOrId("typegen_users"));
  },
);
