const RESOURCE_COLLECTION = "resources";

migrate(
  (app) => {
    const resources = app.findCollectionByNameOrId(RESOURCE_COLLECTION);
    resources.createRule =
      '@request.auth.id != "" && @request.auth.active = true && @request.auth.role = "administrator"';
    app.saveNoValidate(resources);
  },
  () => {},
);
