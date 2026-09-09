const TENANT_COLLECTION = "tenants";
const ORGANIZATIONAL_UNIT_COLLECTION = "organizational_units";
const USER_COLLECTION = "_pb_users_auth_";

const authenticated = '@request.auth.id != "" && @request.auth.active = true';
const administrator = `${authenticated} && @request.auth.role = "administrator"`;

function findCollection(app, ...ids) {
  for (const id of ids) {
    try {
      return app.findCollectionByNameOrId(id);
    } catch {
      // Try the next compatible name or id.
    }
  }
  return null;
}

function setRules(collection, rules) {
  for (const [name, value] of Object.entries(rules)) {
    collection[name] = value;
  }
}

migrate(
  (app) => {
    const tenants = findCollection(app, TENANT_COLLECTION);
    const organizationalUnits = findCollection(app, ORGANIZATIONAL_UNIT_COLLECTION);
    const users = findCollection(app, USER_COLLECTION, "users");

    if (!tenants || !organizationalUnits || !users) {
      throw new Error("F03-T04 requires the tenant, organizational unit, and user collections.");
    }

    setRules(tenants, {
      listRule: `${authenticated} && @request.auth.tenant = id`,
      viewRule: `${authenticated} && @request.auth.tenant = id`,
      createRule: null,
      updateRule: null,
      deleteRule: null,
    });

    setRules(organizationalUnits, {
      listRule: `${authenticated} && @request.auth.tenant = tenant`,
      viewRule: `${authenticated} && @request.auth.tenant = tenant`,
      createRule: administrator,
      updateRule: `${administrator} && @request.auth.tenant = tenant`,
      deleteRule: `${administrator} && @request.auth.tenant = tenant`,
    });

    setRules(users, {
      listRule: `${authenticated} && @request.auth.tenant = tenant`,
      viewRule: `${authenticated} && @request.auth.tenant = tenant`,
      createRule: administrator,
      updateRule: `${authenticated} && @request.auth.tenant = tenant && (@request.auth.role = "administrator" || @request.auth.id = id)`,
      deleteRule: `${administrator} && @request.auth.tenant = tenant`,
    });

    app.saveNoValidate(tenants);
    app.saveNoValidate(organizationalUnits);
    app.saveNoValidate(users);
  },
  () => {},
);
