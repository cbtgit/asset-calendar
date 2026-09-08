migrate(
  (app) => {
    const records = new Collection({
      id: "integration_records",
      name: "integration_records",
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
      ],
      listRule: "",
      viewRule: "",
      createRule: "",
      updateRule: "",
      deleteRule: "",
    });

    app.save(records);

    const record = new Record(records);
    record.set("title", "Initial integration record");
    return app.save(record);
  },
  (app) => {
    return app.delete(app.findCollectionByNameOrId("integration_records"));
  },
);
