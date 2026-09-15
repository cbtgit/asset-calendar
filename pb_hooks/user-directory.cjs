const authConfig = require(`${__hooks}/auth-config.cjs`);
const mailTransport = require(`${__hooks}/mail-transport.cjs`);
const recordAccess = require(`${__hooks}/record-access.cjs`);
const invitationFlow = require(`${__hooks}/invitation-flow.cjs`);

const configuration = authConfig.validateAuthConfig(authConfig.readPocketBaseEnvironment());
const USER_COLLECTION = "users";
const GROUP_COLLECTION = "organizational_units";
const INVITATION_COLLECTION = "user_invitations";
const MAX_NAME_LENGTH = 100;

function has(body, name) {
  return Object.prototype.hasOwnProperty.call(body, name);
}

function bodyOf(event) {
  return event.requestInfo()?.body ?? {};
}

function requireText(value, code, { max = MAX_NAME_LENGTH, required = true } = {}) {
  if (typeof value !== "string") throw new BadRequestError(code);
  const trimmed = value.trim();
  if (required && trimmed === "") throw new BadRequestError(code);
  if (trimmed.length > max) throw new BadRequestError(`${code}_too_long`);
  return trimmed;
}

function requireEmail(value) {
  const email = requireText(value, "email_required", { max: 320 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestError("email_invalid");
  }
  return email.toLowerCase();
}

function requireRole(value) {
  if (value !== "administrator" && value !== "regular") {
    throw new BadRequestError("role_invalid");
  }
  return value;
}

function requireBoolean(value) {
  if (typeof value !== "boolean") throw new BadRequestError("active_invalid");
  return value;
}

function groupForTenant(groupId, tenantId) {
  if (typeof groupId !== "string" || groupId.trim() === "") {
    throw new BadRequestError("group_required");
  }
  let group;
  try {
    group = $app.findRecordById(GROUP_COLLECTION, groupId);
  } catch {
    throw new BadRequestError("group_invalid");
  }
  if (group.get("tenant") !== tenantId) throw new BadRequestError("group_invalid");
  return group;
}

function emailExists(email) {
  try {
    $app.findFirstRecordByData(USER_COLLECTION, "email_normalized", email);
    return true;
  } catch {
    return false;
  }
}

function findUser(id, tenantId) {
  let user;
  try {
    user = $app.findRecordById(USER_COLLECTION, id);
  } catch {
    throw new NotFoundError("user_not_found");
  }
  if (user.get("tenant") !== tenantId) throw new NotFoundError("user_not_found");
  return user;
}

function displayName(record) {
  return [record.get("first_name"), record.get("last_name")]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .join(" ");
}

function projection(record) {
  return {
    id: record.id,
    first_name: record.get("first_name"),
    last_name: record.get("last_name"),
    display_name: displayName(record),
    email: record.get("email"),
    group: record.get("organizational_unit"),
    role: record.get("role"),
    active: record.get("active") === true,
    password_setup_pending: record.get("password_setup_pending") === true,
    created: record.get("created"),
    updated: record.get("updated"),
  };
}

function recordsForTenant(tenantId, activeOnly = false) {
  const filter = activeOnly ? "tenant = {:tenant} && active = true" : "tenant = {:tenant}";
  return $app.findRecordsByFilter(USER_COLLECTION, filter, "last_name,first_name,email,id", 0, 0, {
    tenant: tenantId,
  });
}

function sendInvitation(user) {
  const invitation = invitationFlow.createInvitation({
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
}

function expireOutstandingInvitations(userId) {
  const now = new Date().toISOString();
  const invitations = $app.findRecordsByFilter(
    INVITATION_COLLECTION,
    'user = {:user} && used_at = ""',
    "",
    0,
    0,
    { user: userId },
  );
  for (const invitation of invitations) {
    invitation.set("used_at", now);
    $app.save(invitation);
  }
}

function createUser(event) {
  const context = recordAccess.administratorContext(event);
  const body = bodyOf(event);
  const tenantId = context.context.tenant.id;
  const email = requireEmail(body.email);
  const firstName = requireText(body.first_name ?? "", "first_name_required");
  const lastName = requireText(body.last_name ?? "", "last_name_required");
  const role = requireRole(body.role);
  const groupId = groupForTenant(body.group, tenantId).id;

  if (emailExists(email)) throw new BadRequestError("email_already_exists");

  const user = new Record($app.findCollectionByNameOrId(USER_COLLECTION));
  const temporaryPassword = $security.randomString(48);
  user.set("email", email);
  user.set("email_normalized", email);
  user.set("password", temporaryPassword);
  user.set("passwordConfirm", temporaryPassword);
  user.set("tenant", tenantId);
  user.set("organizational_unit", groupId);
  user.set("first_name", firstName);
  user.set("last_name", lastName);
  user.set("role", role);
  user.set("active", true);
  user.set("password_setup_pending", true);
  try {
    $app.save(user);
  } catch (error) {
    if (emailExists(email)) throw new BadRequestError("email_already_exists");
    throw error;
  }
  sendInvitation(user);
  return event.json(200, projection(user));
}

function updateUser(event) {
  const context = recordAccess.administratorContext(event);
  const body = bodyOf(event);
  const user = findUser(event.request.pathValue("id"), context.context.tenant.id);

  if (has(body, "email") || has(body, "email_normalized") || has(body, "tenant")) {
    throw new ForbiddenError("protected_user_field");
  }

  if (has(body, "first_name"))
    user.set("first_name", requireText(body.first_name, "first_name_required"));
  if (has(body, "last_name"))
    user.set("last_name", requireText(body.last_name, "last_name_required"));
  if (has(body, "group")) {
    user.set("organizational_unit", groupForTenant(body.group, context.context.tenant.id).id);
  }
  if (has(body, "role")) user.set("role", requireRole(body.role));
  if (has(body, "active")) user.set("active", requireBoolean(body.active));

  if (has(body, "action")) {
    if (body.action !== "resend_invitation") throw new BadRequestError("action_invalid");
    if (user.get("password_setup_pending") !== true || user.get("active") !== true) {
      throw new BadRequestError("invitation_not_eligible");
    }
    expireOutstandingInvitations(user.id);
    sendInvitation(user);
  }

  if (
    Object.keys(body).some(
      (key) =>
        key !== "first_name" &&
        key !== "last_name" &&
        key !== "group" &&
        key !== "role" &&
        key !== "active" &&
        key !== "action",
    )
  ) {
    throw new BadRequestError("unknown_user_field");
  }

  $app.save(user);
  return event.json(200, projection(user));
}

function listUsers(event) {
  const context = recordAccess.administratorContext(event);
  return event.json(200, { items: recordsForTenant(context.context.tenant.id).map(projection) });
}

function listActiveUsers(event) {
  const context = recordAccess.administratorContext(event);
  return event.json(200, {
    items: recordsForTenant(context.context.tenant.id, true).map((record) => ({
      id: record.id,
      display_name: displayName(record),
      email: record.get("email"),
      group: record.get("organizational_unit"),
      role: record.get("role"),
    })),
  });
}

function getUser(event) {
  const context = recordAccess.administratorContext(event);
  return event.json(
    200,
    projection(findUser(event.request.pathValue("id"), context.context.tenant.id)),
  );
}

module.exports = {
  createUser,
  getUser,
  listActiveUsers,
  listUsers,
  updateUser,
};
