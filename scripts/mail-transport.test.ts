// @vitest-environment node
import { createRequire } from "node:module";
import { afterEach, expect, it } from "vite-plus/test";

type MailTransport = {
  clearMessages: () => void;
  createInvitationMessage: (input: {
    recipient: string;
    link: string;
    expiresAt: string;
    from?: string;
  }) => { text: string; html: string };
  getMessages: (transport?: "capture" | "test") => Array<{
    from: { address: string };
    to: Array<{ address: string }>;
    text: string;
    html: string;
  }>;
  sendInvitation: (input: {
    configuration: {
      mailTransport: "capture" | "test" | "smtp2go";
      smtp2go?: { from: string; username?: string; password?: string };
    };
    invitation: { recipient: string; link: string; expiresAt: string };
    app?: { newMailClient: () => { send: (message: unknown) => void } };
  }) => void;
};

const mailTransport = createRequire(import.meta.url)(
  "../pb_hooks/mail-transport.cjs",
) as MailTransport;

afterEach(() => mailTransport.clearMessages());

it("creates plain-text and HTML-safe invitation content", () => {
  const providerSecret = "smtp-provider-secret";
  const message = mailTransport.createInvitationMessage({
    recipient: "person@example.test",
    link: "https://example.test/setup?token=abc&next=<safe>",
    expiresAt: "2026-10-09T12:00:00.000Z",
  });

  expect(message.text).toContain("https://example.test/setup?token=abc&next=<safe>");
  expect(message.html).toContain("https://example.test/setup?token=abc&amp;next=&lt;safe&gt;");
  expect(message.text).not.toContain("Correct horse battery staple!");
  expect(message.html).not.toContain("Correct horse battery staple!");
  expect(message.text).not.toContain(providerSecret);
  expect(message.html).not.toContain(providerSecret);
});

it("captures local and CI messages without creating a mail client", () => {
  const app = {
    newMailClient: () => {
      throw new Error("network mail client must not be created");
    },
  };
  const invitation = {
    recipient: "person@example.test",
    link: "https://example.test/setup?token=abc",
    expiresAt: "2026-10-09T12:00:00.000Z",
  };

  mailTransport.sendInvitation({
    configuration: { mailTransport: "capture" },
    invitation,
    app,
  });
  mailTransport.sendInvitation({
    configuration: { mailTransport: "test" },
    invitation,
    app,
  });

  expect(mailTransport.getMessages("capture")).toHaveLength(1);
  expect(mailTransport.getMessages("test")).toHaveLength(1);
  expect(mailTransport.getMessages("capture")[0].text).toContain(invitation.link);
  expect(mailTransport.getMessages("test")[0].text).toContain(invitation.link);
});

it("uses the PocketBase mail client only for SMTP2GO", () => {
  let sentMessage: unknown;
  const providerPassword = "smtp-password-that-must-not-be-mailed";
  mailTransport.sendInvitation({
    configuration: {
      mailTransport: "smtp2go",
      smtp2go: {
        from: "calendar@example.test",
        username: "smtp-user",
        password: providerPassword,
      },
    },
    invitation: {
      recipient: "person@example.test",
      link: "https://example.test/setup?token=abc",
      expiresAt: "2026-10-09T12:00:00.000Z",
    },
    app: {
      newMailClient: () => ({
        send: (message) => {
          sentMessage = message;
        },
      }),
    },
  });

  expect(sentMessage).toMatchObject({
    from: { address: "calendar@example.test" },
    to: [{ address: "person@example.test" }],
  });
  expect(JSON.stringify(sentMessage)).not.toContain(providerPassword);
  expect(mailTransport.getMessages("test")).toHaveLength(0);
});
