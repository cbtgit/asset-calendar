import { createServer } from "node:net";
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vite-plus/test";
import {
  POCKETBASE_MANIFEST,
  POCKETBASE_VERSION,
  assertPortAvailable,
  resetPocketBaseData,
  resolveConfig,
  resolveRuntimePaths,
  resolveTarget,
  verifyChecksum,
} from "./pocketbase.ts";

it("resolves and verifies all supported PocketBase targets", async () => {
  const targets = [
    ["darwin", "x64", "darwin-amd64"],
    ["darwin", "arm64", "darwin-arm64"],
    ["linux", "x64", "linux-amd64"],
    ["linux", "arm64", "linux-arm64"],
  ] as const;

  expect(POCKETBASE_MANIFEST.version).toBe(POCKETBASE_VERSION);
  for (const [platform, architecture, key] of targets) {
    const target = resolveTarget(platform, architecture);
    expect(target.key).toBe(key);
    expect(target.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(target.archive).toContain(
      `pocketbase_${POCKETBASE_VERSION}_${platform}_${target.architecture}.zip`,
    );
  }

  const archive = join(await mkdtemp(join(tmpdir(), "asset-calendar-checksum-")), "archive");
  await writeFile(archive, "verified archive");
  let checksumError: Error | undefined;
  try {
    await verifyChecksum(
      archive,
      "7e6f3f8e0e8b6f1a6c7a5e5a3e5b0f91f4dd8ca1b8e32d7a9aabfdf1e7e2e0c2",
    );
  } catch (error) {
    checksumError = error as Error;
  }
  expect(checksumError?.message).toContain("checksum mismatch");
  await rm(archive, { force: true });
});

it("rejects unsupported targets and unsafe configuration", () => {
  expect(() => resolveTarget("win32", "x64")).toThrow("Supported targets");
  expect(() => resolveConfig({ POCKETBASE_HOST: "0.0.0.0" })).toThrow("loopback-only");
  expect(() => resolveConfig({ POCKETBASE_PORT: "65536" })).toThrow("1 to 65535");
  expect(resolveConfig()).toEqual({ host: "127.0.0.1", port: 8090 });
});

it("keeps reset worktree-scoped and requires force in non-interactive mode", async () => {
  const root = await mkdtemp(join(tmpdir(), "asset-calendar-reset-"));
  const paths = resolveRuntimePaths(root, "linux", "x64");
  const outside = join(root, "..", "asset-calendar-reset-sentinel");
  try {
    await writeFile(outside, "keep me");
    await mkdir(paths.dataDir, { recursive: true });
    await writeFile(join(paths.dataDir, "record.txt"), "delete me");

    let error: Error | undefined;
    try {
      await resetPocketBaseData(paths, { interactive: false });
    } catch (caught) {
      error = caught as Error;
    }
    expect(error?.message).toContain("explicit --force");

    await resetPocketBaseData(paths, { interactive: false, force: true });
    await readFile(outside);
    await expectPathToBeMissing(paths.dataDir);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { force: true });
  }
});

it("reports an occupied port clearly", async () => {
  const server = createServer().listen(0, "127.0.0.1");
  await new Promise<void>((resolvePromise) => server.once("listening", () => resolvePromise()));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Test server did not bind to a port.");

  let error: Error | undefined;
  try {
    await assertPortAvailable("127.0.0.1", address.port);
  } catch (caught) {
    error = caught as Error;
  } finally {
    server.close();
  }
  expect(error?.message).toContain("already in use");
});

async function expectPathToBeMissing(path: string): Promise<void> {
  let missing = false;
  try {
    await lstat(path);
  } catch (error) {
    missing = (error as NodeJS.ErrnoException).code === "ENOENT";
  }
  expect(missing).toBe(true);
}
