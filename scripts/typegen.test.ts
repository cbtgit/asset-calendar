// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, it } from "vite-plus/test";
import { assertPocketBaseTypegenIncompatible, generatePocketBaseTypes } from "./typegen.ts";

it("generates representative PocketBase types deterministically from migrations", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "asset-calendar-typegen-test-"));
  try {
    const first = await generatePocketBaseTypes(join(temporaryRoot, "first.ts"));
    const second = await generatePocketBaseTypes(join(temporaryRoot, "second.ts"));

    expect(first).toBe(second);
    expect(first).toContain("export type TypegenRecordsRecord");
    expect(first).toContain("kind: TypegenRecordsKindOptions");
    expect(first).toContain("owner: RecordIdString");
    expect(first).toContain("export type CreateAuth");
    expect(first).toContain("export type UpdateBase");
    await assertPocketBaseTypegenIncompatible();
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}, 15000);
