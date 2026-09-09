const authConfig = require(`${__hooks}/auth-config.cjs`);
const tenantResolver = require(`${__hooks}/tenant-host-resolver.cjs`);
const mailTransport = require(`${__hooks}/mail-transport.cjs`);

const configuration = authConfig.validateAuthConfig(authConfig.readPocketBaseEnvironment());
const USER_COLLECTION = "users";
const INVITATION_COLLECTION = "user_invitations";
const TOKEN_LENGTH = 64;
const INVALID_INVITATION_MESSAGE = "Invalid or expired invitation.";
const GENERIC_INVITATION_MESSAGE = "If the invitation is eligible, an email will be sent.";

function invalidInvitation() {
  throw new BadRequestError(INVALID_INVITATION_MESSAGE, null);
}

function requestTenant(event, app) {
  const info = event.requestInfo();
  if (!info) invalidInvitation();

  const context = tenantResolver.resolveTenantContextSync(
    {
      host: typeof event.request?.host === "string" ? event.request.host : undefined,
      remoteAddress: info.remoteIP,
      requestInfo: () => info,
    },
    configuration,
    ({ subdomain }) => {
      try {
        const record = app.findFirstRecordByData("tenants", "subdomain", subdomain);
        return { id: record.id, subdomain: record.get("subdomain") };
      } catch {
        return null;
      }
    },
  );

  if (context.kind !== "resolved") invalidInvitation();
  return context.tenant.id;
}

function isSuperuser(event) {
  return typeof event.hasSuperuserAuth === "function" && event.hasSuperuserAuth();
}

function requireAdministrator(event, tenantId) {
  if (isSuperuser(event)) return;

  const auth = event.auth;
  if (
    !auth ||
    auth.collection().type !== "auth" ||
    auth.get("active") !== true ||
    auth.get("role") !== "administrator" ||
    auth.get("tenant") !== tenantId
  ) {
    throw new ForbiddenError("authorization_failed");
  }
}

function hashToken(token, security) {
  return security.sha256(token);
}

function invitationLink(invitationUrl, token) {
  const separator = invitationUrl.includes("?") ? "&" : "?";
  return `${invitationUrl}${separator}token=${encodeURIComponent(token)}`;
}

function isUsed(invitation) {
  const usedAt = invitation.get("used_at");
  return usedAt !== undefined && usedAt !== null && String(usedAt) !== "";
}

function isInvitationValid(invitation, tenantId, now) {
  const expiresAt = new Date(invitation.get("expires_at"));
  return (
    !isUsed(invitation) &&
    Number.isFinite(expiresAt.getTime()) &&
    expiresAt.getTime() > now.getTime() &&
    invitation.get("tenant") === tenantId
  );
}

function saveSetup(app, user, invitation, usedAt) {
  const save = (transactionApp) => {
    transactionApp.save(user);
    invitation.set("used_at", usedAt.toISOString());
    transactionApp.save(invitation);
  };

  if (typeof app.runInTransaction === "function") {
    app.runInTransaction((transactionApp) => save(transactionApp));
  } else {
    save(app);
  }
}

function createInvitation({
  app,
  security,
  user,
  invitationUrl,
  lifetimeHours,
  now = () => new Date(),
}) {
  const issuedAt = now();
  const expiresAt = new Date(issuedAt.getTime() + lifetimeHours * 60 * 60 * 1000);
  const token = security.randomString(TOKEN_LENGTH);
  const tenantId = user.get("tenant");
  const invitation = new Record(app.findCollectionByNameOrId(INVITATION_COLLECTION));

  invitation.set("user", user.id);
  invitation.set("tenant", tenantId);
  invitation.set("token_hash", hashToken(token, security));
  invitation.set("expires_at", expiresAt.toISOString());
  app.save(invitation);

  return {
    recipient: user.get("email"),
    link: invitationLink(invitationUrl, token),
    expiresAt: expiresAt.toISOString(),
  };
}

function createInvitationRoute(event) {
  const tenantId = requestTenant(event, $app);
  requireAdministrator(event, tenantId);

  const body = new DynamicModel({ user: "" });
  event.bindBody(body);

  let user;
  try {
    user = $app.findRecordById(USER_COLLECTION, body.user);
  } catch {
    throw new ForbiddenError("authorization_failed");
  }

  if (
    user.get("tenant") !== tenantId ||
    user.get("active") !== true ||
    user.get("password_setup_pending") !== true
  ) {
    throw new ForbiddenError("authorization_failed");
  }

  const invitation = createInvitation({
    app: $app,
    security: $security,
    user,
    invitationUrl: configuration.invitationUrl,
    lifetimeHours: configuration.invitationLifetimeHours,
  });

  try {
    mailTransport.sendInvitation({ configuration, invitation, app: $app });
  } catch {
    throw new InternalServerError("invitation_delivery_failed");
  }

  return event.json(200, { message: GENERIC_INVITATION_MESSAGE });
}

function completePasswordSetup(event, { now = () => new Date() } = {}) {
  const body = new DynamicModel({ token: "", password: "" });
  event.bindBody(body);

  if (typeof body.token !== "string" || body.token.length !== TOKEN_LENGTH) {
    invalidInvitation();
  }
  if (typeof body.password !== "string") invalidInvitation();

  const tenantId = requestTenant(event, $app);
  let invitation;
  try {
    invitation = $app.findFirstRecordByData(
      INVITATION_COLLECTION,
      "token_hash",
      hashToken(body.token, $security),
    );
  } catch {
    invalidInvitation();
  }

  const currentTime = now();
  if (!isInvitationValid(invitation, tenantId, currentTime)) {
    invalidInvitation();
  }

  let user;
  try {
    user = $app.findRecordById(USER_COLLECTION, invitation.get("user"));
  } catch {
    invalidInvitation();
  }
  if (
    user.get("tenant") !== tenantId ||
    user.get("active") !== true ||
    user.get("password_setup_pending") !== true
  ) {
    invalidInvitation();
  }

  user.set("password", body.password);
  user.set("passwordConfirm", body.password);
  user.set("password_setup_pending", false);
  saveSetup($app, user, invitation, currentTime);

  return $apis.recordAuthResponse(event, user, "", null);
}

module.exports = {
  TOKEN_LENGTH,
  INVALID_INVITATION_MESSAGE,
  GENERIC_INVITATION_MESSAGE,
  createInvitation,
  isInvitationValid,
  createInvitationRoute,
  completePasswordSetup,
};
