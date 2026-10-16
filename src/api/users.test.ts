import { afterEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "./client";
import { createUser, getActiveUsers, getUsers, resendUserInvitation, updateUser } from "./users";

afterEach(() => {
  vi.restoreAllMocks();
});

const user = {
  id: "user-1",
  first_name: "Ada",
  last_name: "Lovelace",
  display_name: "Ada Lovelace",
  email: "ada@example.test",
  account_reference_number: "AC-42",
  role: "regular" as const,
  active: true,
  password_setup_pending: true,
  created: "2026-01-01T00:00:00Z",
  updated: "2026-01-01T00:00:00Z",
};

it("uses server-owned projections for directory and active users", async () => {
  const activeUser = {
    id: user.id,
    display_name: user.display_name,
    email: user.email,
    role: user.role,
  };
  const send = vi
    .spyOn(pocketbase, "send")
    .mockResolvedValueOnce({ items: [user] })
    .mockResolvedValueOnce({ items: [activeUser] });

  await expect(getUsers()).resolves.toEqual([user]);
  await expect(getActiveUsers()).resolves.toEqual([activeUser]);
  expect(send).toHaveBeenNthCalledWith(1, "/api/users", { method: "GET" });
  expect(send).toHaveBeenNthCalledWith(2, "/api/users/active", { method: "GET" });
});

it("sends creation, update, and invitation mutations through user routes", async () => {
  const send = vi.spyOn(pocketbase, "send").mockResolvedValue(user);
  const input = {
    first_name: "Ada",
    last_name: "Lovelace",
    email: "ada@example.test",
    account_reference_number: "AC-42",
    role: "regular" as const,
  };

  await createUser(input);
  await updateUser(user.id, { active: false });
  await resendUserInvitation(user.id);

  expect(send).toHaveBeenNthCalledWith(1, "/api/users", { method: "POST", body: input });
  expect(send).toHaveBeenNthCalledWith(2, "/api/users/user-1", {
    method: "PATCH",
    body: { active: false },
  });
  expect(send).toHaveBeenNthCalledWith(3, "/api/users/user-1", {
    method: "PATCH",
    body: { action: "resend_invitation" },
  });
});
