const DEFAULT_SENDER = "calendar@localhost";
const INVITATION_SUBJECT = "Your Asset Calendar invitation";
const messages = {
  capture: [],
  test: [],
};

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}

function createInvitationMessage({ recipient, link, expiresAt, from = DEFAULT_SENDER }) {
  const expiry = new Date(expiresAt);
  if (
    typeof recipient !== "string" ||
    recipient.trim() === "" ||
    typeof link !== "string" ||
    link.trim() === "" ||
    !Number.isFinite(expiry.getTime())
  ) {
    throw new Error("Invitation mail data is invalid.");
  }

  const text = [
    "You have been invited to Asset Calendar.",
    `Open this link to set your password: ${link}`,
    `This link expires on ${expiry.toISOString()}.`,
  ].join("\n\n");
  const safeLink = escapeHtml(link);
  const html = [
    "<p>You have been invited to Asset Calendar.</p>",
    `<p><a href="${safeLink}">Set your password</a></p>`,
    `<p>This link expires on ${escapeHtml(expiry.toISOString())}.</p>`,
  ].join("");

  return {
    from: { address: from },
    to: [{ address: recipient }],
    subject: INVITATION_SUBJECT,
    text,
    html,
  };
}

function copyMessage(message) {
  return {
    ...message,
    from: { ...message.from },
    to: message.to.map((address) => ({ ...address })),
  };
}

function sendInvitation({ configuration, invitation, app = globalThis.$app }) {
  const message = createInvitationMessage({
    ...invitation,
    from: configuration.smtp2go?.from,
  });

  if (configuration.mailTransport === "capture" || configuration.mailTransport === "test") {
    messages[configuration.mailTransport].push(copyMessage(message));
    return;
  }

  if (configuration.mailTransport !== "smtp2go") {
    throw new Error("Unsupported mail transport.");
  }
  if (!app || typeof app.newMailClient !== "function") {
    throw new Error("PocketBase mail client is unavailable.");
  }

  const mailMessage = typeof MailerMessage === "function" ? new MailerMessage(message) : message;
  app.newMailClient().send(mailMessage);
}

function getMessages(transport = "test") {
  if (transport !== "capture" && transport !== "test") {
    throw new Error("Unsupported mail transport.");
  }
  return messages[transport].map(copyMessage);
}

function clearMessages(transport) {
  if (transport === undefined) {
    messages.capture.length = 0;
    messages.test.length = 0;
    return;
  }
  if (transport !== "capture" && transport !== "test") {
    throw new Error("Unsupported mail transport.");
  }
  messages[transport].length = 0;
}

module.exports = {
  INVITATION_SUBJECT,
  clearMessages,
  createInvitationMessage,
  getMessages,
  sendInvitation,
};
