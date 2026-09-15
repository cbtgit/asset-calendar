routerAdd("GET", "/api/users", (event) =>
  require(`${__hooks}/user-directory.cjs`).listUsers(event),
);
routerAdd("POST", "/api/users", (event) =>
  require(`${__hooks}/user-directory.cjs`).createUser(event),
);
routerAdd("GET", "/api/users/active", (event) =>
  require(`${__hooks}/user-directory.cjs`).listActiveUsers(event),
);
routerAdd("GET", "/api/users/{id}", (event) =>
  require(`${__hooks}/user-directory.cjs`).getUser(event),
);
routerAdd("PATCH", "/api/users/{id}", (event) =>
  require(`${__hooks}/user-directory.cjs`).updateUser(event),
);
