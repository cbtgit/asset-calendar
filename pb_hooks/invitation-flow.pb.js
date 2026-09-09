routerAdd("POST", "/api/invitations", (event) =>
  require(`${__hooks}/invitation-flow.cjs`).createInvitationRoute(event),
);
routerAdd("POST", "/api/invitations/setup", (event) =>
  require(`${__hooks}/invitation-flow.cjs`).completePasswordSetup(event),
);
