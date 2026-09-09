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
      smtp2go?: { from: string };
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
  const message = mailTransport.createInvitationMessage({
    recipient: "person@example.test",
    link: "https://example.test/setup?token=abc&next=<safe>",
    expiresAt: "2026-10-09T12:00:00.000Z",
  });

  expect(message.text).toContain("https://example.test/setup?token=abc&next=<safe>");
  expect(message.html).toContain("https://example.test/setup?token=abc&amp;next=&lt;safe&gt;");
  expect(message.text).not.toContain("Correct horse battery staple!");
  expect(message.html).not.toContain("Correct horse battery staple!");
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
});

it("uses the PocketBase mail client only for SMTP2GO", () => {
  let sentMessage: unknown;
  mailTransport.sendInvitation({
    configuration: {
      mailTransport: "smtp2go",
      smtp2go: { from: "calendar@example.test" },
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
  expect(mailTransport.getMessages("test")).toHaveLength(0);
});
