import { expect, it } from "vite-plus/test";
import { Collections } from "./pocketbase-types.ts";
import type {
  Create,
  TypegenRecordsResponse,
  TypegenUsersResponse,
  Update,
} from "./pocketbase-types.ts";

type TypegenRecordsCollection = (typeof Collections)["TypegenRecords"];
type TypegenUsersCollection = (typeof Collections)["TypegenUsers"];

it("exposes representative PocketBase create, update, and expansion types", () => {
  const recordCreate: Create<TypegenRecordsCollection> = {
    title: "Example",
    amount: 12.5,
    active: true,
    when: "2026-01-01 00:00:00.000Z",
    kind: "one",
    metadata: { source: "test" },
    attachment: new File(["fixture"], "fixture.png", { type: "image/png" }),
    owner: "typegen-user-id",
  };
  const recordUpdate: Update<TypegenRecordsCollection> = {
    amount: 13,
    kind: "two",
    owner: "another-user-id",
  };
  const authCreate: Create<TypegenUsersCollection> = {
    displayName: "Example User",
    email: "example@example.com",
    password: "password",
    passwordConfirm: "password",
  };
  const authUpdate: Update<TypegenUsersCollection> = {
    displayName: "Updated User",
    verified: true,
  };

  const expanded:
    | TypegenRecordsResponse<{ source: string }, { owner: TypegenUsersResponse }>
    | undefined = undefined;
  expect([recordCreate, recordUpdate, authCreate, authUpdate, expanded]).toBeTruthy();
});
