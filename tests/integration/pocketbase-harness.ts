/// <reference types="node" />

import { randomBytes } from "node:crypto";
import type { ChildProcess } from "node:child_process";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  findAvailablePort,
  resolveRuntimePaths,
  startPocketBase,
  stopPocketBase,
} from "../../scripts/pocketbase.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const migrationsDir = resolve(root, "tests/fixtures/pocketbase-integration/migrations");

export type PocketBaseIntegrationHarness = {
  baseUrl: string;
  dataDir: string;
  stop: () => Promise<void>;
};

export async function startPocketBaseIntegrationHarness(
  options: {
    migrationsDir?: string;
  } = {},
): Promise<PocketBaseIntegrationHarness> {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "asset-calendar-integration-"));
  const dataDir = join(temporaryRoot, "data");
  await mkdir(dataDir);

  let child: ChildProcess | undefined;
  let port = 0;
  try {
    const paths = { ...resolveRuntimePaths(root), dataDir };
    for (let attempt = 0; attempt < 10; attempt += 1) {
      port = await findAvailablePort();
      try {
        child = await startPocketBase({
          config: { host: "127.0.0.1", port },
          paths,
          migrationsDir: options.migrationsDir ?? migrationsDir,
          superuser: {
            email: "integration-superuser@example.test",
            password: randomBytes(32).toString("base64url"),
          },
        });
        break;
      } catch (error) {
        if (error instanceof Error && error.message.includes("is already in use") && attempt < 9) {
          continue;
        }
        throw error;
      }
    }
    if (!child) throw new Error("Unable to start PocketBase on any available port.");
  } catch (error) {
    await rm(temporaryRoot, { recursive: true, force: true });
    throw error;
  }

  let stopped = false;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    dataDir,
    stop: async () => {
      if (stopped) return;
      stopped = true;
      let stopError: unknown;
      try {
        await stopPocketBase(child as ChildProcess);
      } catch (error) {
        stopError = error;
      }
      try {
        await rm(temporaryRoot, { recursive: true, force: true });
      } catch (cleanupError) {
        throw new AggregateError(
          [stopError, cleanupError].filter((error) => error !== undefined),
          "Failed to clean up the PocketBase integration harness.",
        );
      }
      if (stopError) throw stopError;
    },
  };
}
