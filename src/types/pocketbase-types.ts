import type PocketBase from "pocketbase";
import type { RecordService } from "pocketbase";

export const Collections = {
  TypegenRecords: "typegen_records",
  TypegenUsers: "typegen_users",
} as const;
export type Collections = (typeof Collections)[keyof typeof Collections];

export type IsoDateString = string;
export type RecordIdString = string;
export type FileNameString = string & { readonly filename: unique symbol };

export type BaseSystemFields<T = unknown> = {
  id: RecordIdString;
  collectionId: string;
  collectionName: Collections;
} & (unknown extends T ? { expand?: unknown } : { expand: T });

export type AuthSystemFields<T = unknown> = {
  email: string;
  emailVisibility: boolean;
  username: string;
  verified: boolean;
} & BaseSystemFields<T>;

export type TypegenRecordsKind = "one" | "two";

export type TypegenRecordsRecord<TMetadata = unknown> = {
  active?: boolean;
  amount: number;
  attachment?: FileNameString;
  id: RecordIdString;
  kind: TypegenRecordsKind;
  metadata?: null | TMetadata;
  owner: RecordIdString;
  title: string;
  when?: IsoDateString;
};

export type TypegenUsersRecord = {
  displayName: string;
  email: string;
  emailVisibility?: boolean;
  id: RecordIdString;
  verified?: boolean;
};

export type TypegenRecordsResponse<
  TMetadata = unknown,
  TExpand = unknown,
> = Required<TypegenRecordsRecord<TMetadata>> & BaseSystemFields<TExpand>;
export type TypegenUsersResponse<TExpand = unknown> =
  Required<TypegenUsersRecord> & AuthSystemFields<TExpand>;

export type CollectionRecords = {
  typegen_records: TypegenRecordsRecord;
  typegen_users: TypegenUsersRecord;
};

export type CollectionResponses = {
  typegen_records: TypegenRecordsResponse;
  typegen_users: TypegenUsersResponse;
};

export type TypegenRecordsCreate = {
  id?: RecordIdString;
  active?: boolean;
  amount: number;
  attachment?: File;
  kind: TypegenRecordsKind;
  metadata?: unknown;
  owner: RecordIdString;
  title: string;
  when?: IsoDateString;
};

export type TypegenRecordsUpdate = Partial<Omit<TypegenRecordsCreate, "id">>;

export type TypegenUsersCreate = {
  id?: RecordIdString;
  displayName: string;
  email: string;
  emailVisibility?: boolean;
  password: string;
  passwordConfirm: string;
  verified?: boolean;
};

export type TypegenUsersUpdate = Partial<
  Omit<TypegenUsersCreate, "id" | "passwordConfirm">
> & {
  oldPassword?: string;
  passwordConfirm?: string;
};

export type Create<T extends keyof CollectionResponses> =
  T extends "typegen_records" ? TypegenRecordsCreate : TypegenUsersCreate;
export type Update<T extends keyof CollectionResponses> =
  T extends "typegen_records" ? TypegenRecordsUpdate : TypegenUsersUpdate;

export type TypedPocketBase = {
  collection<T extends keyof CollectionResponses>(
    idOrName: T,
  ): RecordService<CollectionResponses[T]>;
} & PocketBase;
