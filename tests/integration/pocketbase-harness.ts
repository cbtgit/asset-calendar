/// <reference types="node" />

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

export async function startPocketBaseIntegrationHarness(): Promise<PocketBaseIntegrationHarness> {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "asset-calendar-integration-"));
  const dataDir = join(temporaryRoot, "data");
  await mkdir(dataDir);

  let child: ChildProcess | undefined;
  let port: number;
  try {
    port = await findAvailablePort();
    const paths = { ...resolveRuntimePaths(root), dataDir };
    child = await startPocketBase({
      config: { host: "127.0.0.1", port },
      paths,
      migrationsDir,
    });
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
          [stopError, cleanupError].filter((error): error is Error => error instanceof Error),
          "Failed to clean up the PocketBase integration harness.",
        );
      }
      if (stopError) throw stopError;
    },
  };
}
