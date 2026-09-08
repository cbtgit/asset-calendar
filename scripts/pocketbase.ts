import { createHash } from "node:crypto";
import { execFileSync, spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { chmod, lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { get as httpsGet } from "node:https";
import { homedir } from "node:os";
import { createServer, isIP } from "node:net";
import { fileURLToPath } from "node:url";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { createInterface } from "node:readline/promises";

export const POCKETBASE_VERSION = "0.40.3";
const RELEASE_URL = `https://github.com/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}`;
const HEALTH_TIMEOUT_MS = 30_000;

export type PocketBaseTarget = {
  key: keyof PocketBaseManifest["releases"];
  platform: "darwin" | "linux";
  architecture: "amd64" | "arm64";
  archive: string;
  checksum: string;
};

type PocketBaseManifest = {
  version: string;
  releases: Record<string, { archive: string; sha256: string }>;
};

export type RuntimePaths = {
  worktreeRoot: string;
  dataDir: string;
  migrationsDir: string;
  hooksDir: string;
  cacheDir: string;
  archivePath: string;
  binaryPath: string;
  verificationPath: string;
  target: PocketBaseTarget;
};

export type RuntimeConfig = {
  host: string;
  port: number;
};

export type PocketBaseStartOptions = {
  config?: RuntimeConfig;
  paths?: RuntimePaths;
  migrationsDir?: string;
  hooksDir?: string;
};

export type ParsedArguments = {
  command: "start" | "reset";
  force: boolean;
  host?: string;
  port?: string;
};

const manifestPath = resolve(dirname(fileURLToPath(import.meta.url)), "pocketbase-checksums.json");
export const POCKETBASE_MANIFEST = JSON.parse(
  readFileSync(manifestPath, "utf8"),
) as PocketBaseManifest;

if (POCKETBASE_MANIFEST.version !== POCKETBASE_VERSION) {
  throw new Error(
    `PocketBase manifest version ${POCKETBASE_MANIFEST.version} does not match ${POCKETBASE_VERSION}.`,
  );
}

export function resolveTarget(
  platform = process.platform,
  architecture = process.arch,
): PocketBaseTarget {
  const normalizedPlatform = platform === "darwin" || platform === "linux" ? platform : undefined;
  const normalizedArchitecture =
    architecture === "x64" ? "amd64" : architecture === "arm64" ? "arm64" : undefined;

  if (!normalizedPlatform || !normalizedArchitecture) {
    throw new Error(
      `Unsupported PocketBase platform: ${platform}/${architecture}. Supported targets are macOS and Linux on x64 or arm64.`,
    );
  }

  const key =
    `${normalizedPlatform}-${normalizedArchitecture}` as keyof PocketBaseManifest["releases"];
  const release = POCKETBASE_MANIFEST.releases[key];
  if (!release) {
    throw new Error(`PocketBase checksum manifest has no entry for ${key}.`);
  }

  return {
    key,
    platform: normalizedPlatform,
    architecture: normalizedArchitecture,
    archive: release.archive,
    checksum: release.sha256,
  };
}

export function resolveCacheRoot(
  platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (env.XDG_CACHE_HOME) {
    return resolve(env.XDG_CACHE_HOME);
  }
  return platform === "darwin" ? join(homedir(), "Library", "Caches") : join(homedir(), ".cache");
}

export function resolveWorktreeRoot(cwd = process.cwd()): string {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`Unable to resolve the current Git worktree from ${cwd}.`);
  }
  return resolve(result.stdout.trim());
}

function assertDescendant(root: string, candidate: string, label: string): void {
  const relativePath = relative(root, candidate);
  if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error(`${label} must remain inside the current worktree.`);
  }
}

export function resolveRuntimePaths(
  worktreeRoot = resolveWorktreeRoot(),
  platform = process.platform,
  architecture = process.arch,
): RuntimePaths {
  const root = resolve(worktreeRoot);
  const target = resolveTarget(platform, architecture);
  const dataDir = join(root, ".local", "pocketbase", "data");
  const migrationsDir = join(root, "pb_migrations");
  const hooksDir = join(root, "pb_hooks");
  const cacheDir = join(
    resolveCacheRoot(platform),
    "asset-calendar",
    "pocketbase",
    POCKETBASE_VERSION,
    target.key,
  );

  assertDescendant(root, dataDir, "PocketBase data directory");
  assertDescendant(root, migrationsDir, "PocketBase migrations directory");
  assertDescendant(root, hooksDir, "PocketBase hooks directory");

  return {
    worktreeRoot: root,
    dataDir,
    migrationsDir,
    hooksDir,
    cacheDir,
    archivePath: join(cacheDir, target.archive),
    binaryPath: join(cacheDir, "pocketbase"),
    verificationPath: join(cacheDir, "verified.json"),
    target,
  };
}

async function assertNoSymlinkInPath(root: string, candidate: string): Promise<void> {
  const relativePath = relative(root, candidate);
  let current = root;
  for (const segment of relativePath.split("/")) {
    current = join(current, segment);
    try {
      if ((await lstat(current)).isSymbolicLink()) {
        throw new Error(`PocketBase data path contains a symbolic link: ${current}`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return;
      }
      throw error;
    }
  }
}

async function sha256(path: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

export async function verifyChecksum(path: string, expected: string): Promise<void> {
  const actual = await sha256(path);
  if (actual !== expected) {
    throw new Error(
      `PocketBase checksum mismatch for ${path}: expected ${expected}, received ${actual}.`,
    );
  }
}

async function downloadArchive(paths: RuntimePaths): Promise<void> {
  const temporaryPath = `${paths.archivePath}.download-${process.pid}`;
  try {
    await writeFile(temporaryPath, await download(`${RELEASE_URL}/${paths.target.archive}`), {
      mode: 0o600,
    });
    await verifyChecksum(temporaryPath, paths.target.checksum);
    await rename(temporaryPath, paths.archivePath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

function download(url: string, redirects = 0): Promise<Buffer> {
  return new Promise<Buffer>((resolvePromise, rejectPromise) => {
    const request = httpsGet(url, (response) => {
      const status = response.statusCode ?? 0;
      const location = response.headers.location;
      if (status >= 300 && status < 400 && location) {
        response.resume();
        if (redirects >= 5) {
          rejectPromise(new Error(`PocketBase download redirected too many times: ${url}`));
          return;
        }
        download(new URL(location, url).toString(), redirects + 1).then(
          resolvePromise,
          rejectPromise,
        );
        return;
      }
      if (status < 200 || status >= 300) {
        response.resume();
        rejectPromise(new Error(`PocketBase download failed with HTTP ${status}.`));
        return;
      }

      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      response.on("end", () => resolvePromise(Buffer.concat(chunks)));
      response.on("error", rejectPromise);
    });
    request.on("error", rejectPromise);
  });
}

function extractBinary(archivePath: string, binaryPath: string): Promise<void> {
  return (async () => {
    const temporaryPath = `${binaryPath}.extract-${process.pid}`;
    try {
      const binary = execFileSync("unzip", ["-p", archivePath, "pocketbase"], {
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 32 * 1024 * 1024,
      });
      if (!binary.length) {
        throw new Error(`PocketBase archive ${basename(archivePath)} does not contain a binary.`);
      }
      await writeFile(temporaryPath, binary, { mode: 0o755 });
      await chmod(temporaryPath, 0o755);
      await rename(temporaryPath, binaryPath);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw new Error(
        `Unable to extract the verified PocketBase archive: ${(error as Error).message}`,
      );
    }
  })();
}

export async function ensurePocketBaseBinary(paths = resolveRuntimePaths()): Promise<string> {
  await mkdir(paths.cacheDir, { recursive: true });
  if (existsSync(paths.archivePath)) {
    await verifyChecksum(paths.archivePath, paths.target.checksum);
  } else {
    await downloadArchive(paths);
  }

  let verifiedBinary = false;
  if (existsSync(paths.binaryPath) && existsSync(paths.verificationPath)) {
    try {
      const verification = JSON.parse(await readFile(paths.verificationPath, "utf8")) as {
        archiveChecksum: string;
        binaryChecksum: string;
      };
      verifiedBinary =
        verification.archiveChecksum === paths.target.checksum &&
        (await sha256(paths.binaryPath)) === verification.binaryChecksum;
    } catch {
      verifiedBinary = false;
    }
  }

  if (!verifiedBinary) {
    await extractBinary(paths.archivePath, paths.binaryPath);
    await writeFile(
      paths.verificationPath,
      `${JSON.stringify({ archiveChecksum: paths.target.checksum, binaryChecksum: await sha256(paths.binaryPath) }, null, 2)}\n`,
      { mode: 0o600 },
    );
  }

  return paths.binaryPath;
}

function validateHost(host: string): string {
  const normalized = host.trim();
  const ipVersion = isIP(normalized);
  const loopback =
    normalized === "localhost" ||
    (ipVersion === 4 && normalized.startsWith("127.")) ||
    normalized === "::1";
  if (!loopback) {
    throw new Error(
      `PocketBase host must be loopback-only (127.0.0.1, ::1, or localhost); received ${host}.`,
    );
  }
  return normalized;
}

function validatePort(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`PocketBase port must be an integer from 1 to 65535; received ${value}.`);
  }
  const port = Number(value);
  if (port < 1 || port > 65535) {
    throw new Error(`PocketBase port must be an integer from 1 to 65535; received ${value}.`);
  }
  return port;
}

export function parseArguments(args: readonly string[]): ParsedArguments {
  let command: ParsedArguments["command"] = "start";
  let force = false;
  let host: string | undefined;
  let port: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--") {
      continue;
    } else if (argument === "start" || argument === "reset") {
      command = argument;
    } else if (argument === "--force") {
      force = true;
    } else if (argument === "--host" || argument === "--port") {
      const value = args[index + 1];
      if (!value) {
        throw new Error(`${argument} requires a value.`);
      }
      if (argument === "--host") host = value;
      else port = value;
      index += 1;
    } else if (argument.startsWith("--host=")) {
      host = argument.slice("--host=".length);
    } else if (argument.startsWith("--port=")) {
      port = argument.slice("--port=".length);
    } else {
      throw new Error(`Unknown PocketBase option: ${argument}`);
    }
  }

  return { command, force, host, port };
}

export function resolveConfig(
  env: NodeJS.ProcessEnv = process.env,
  args: readonly string[] = [],
): RuntimeConfig {
  const parsed = parseArguments(args);
  return {
    host: validateHost(parsed.host ?? env.POCKETBASE_HOST ?? "127.0.0.1"),
    port: validatePort(parsed.port ?? env.POCKETBASE_PORT ?? "8090"),
  };
}

export async function assertPortAvailable(host: string, port: number): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const server = createServer();
    server.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        rejectPromise(
          new Error(`PocketBase port ${host}:${port} is already in use. Choose another port.`),
        );
      } else {
        rejectPromise(error);
      }
    });
    server.listen(port, host, () => {
      server.close((error) => (error ? rejectPromise(error) : resolvePromise()));
    });
  });
}

export async function findAvailablePort(host = "127.0.0.1"): Promise<number> {
  return new Promise<number>((resolvePromise, rejectPromise) => {
    const server = createServer();
    server.once("error", rejectPromise);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        rejectPromise(new Error("Unable to determine the dynamically allocated port."));
        return;
      }
      server.close((error) => (error ? rejectPromise(error) : resolvePromise(address.port)));
    });
  });
}

function pocketBaseAddress(host: string, port: number): string {
  return host.includes(":") ? `[${host}]:${port}` : `${host}:${port}`;
}

async function runMigrations(
  binaryPath: string,
  paths: RuntimePaths,
  migrationsDir: string,
): Promise<void> {
  execFileSync(
    binaryPath,
    ["migrate", "up", `--dir=${paths.dataDir}`, `--migrationsDir=${migrationsDir}`],
    { cwd: paths.worktreeRoot, stdio: "inherit" },
  );
}

async function waitForHealth(child: ChildProcess, healthUrl: string): Promise<void> {
  let exited: Error | undefined;
  child.once("exit", (code, signal) => {
    exited = new Error(
      `PocketBase exited before becoming healthy (code ${code ?? "none"}, signal ${signal ?? "none"}).`,
    );
  });

  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (exited) throw exited;
    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {
      // PocketBase may still be starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(
    `PocketBase did not become healthy at ${healthUrl} within ${HEALTH_TIMEOUT_MS / 1000} seconds.`,
  );
}

async function terminateChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;

  await new Promise<void>((resolvePromise) => {
    let forceTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = (): void => {
      if (forceTimer) clearTimeout(forceTimer);
      child.off("exit", finish);
      resolvePromise();
    };

    child.once("exit", finish);
    if (child.exitCode !== null || child.signalCode !== null || !child.kill("SIGTERM")) {
      finish();
      return;
    }
    forceTimer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null && !child.kill("SIGKILL")) {
        finish();
      }
    }, 1_000);
  });
}

export async function startPocketBase(
  optionsOrConfig: PocketBaseStartOptions | RuntimeConfig = {},
): Promise<ChildProcess> {
  const options = "host" in optionsOrConfig ? { config: optionsOrConfig } : optionsOrConfig;
  const config = options.config ?? resolveConfig();
  const paths = options.paths ?? resolveRuntimePaths();
  const migrationsDir = options.migrationsDir ?? paths.migrationsDir;
  const hooksDir = options.hooksDir ?? paths.hooksDir;
  const dataRoot = paths.dataDir.startsWith(`${paths.worktreeRoot}/`)
    ? paths.worktreeRoot
    : dirname(paths.dataDir);
  await assertNoSymlinkInPath(dataRoot, paths.dataDir);
  await assertPortAvailable(config.host, config.port);
  await mkdir(paths.dataDir, { recursive: true });
  await runMigrations(await ensurePocketBaseBinary(paths), paths, migrationsDir);

  const child = spawn(
    paths.binaryPath,
    [
      "serve",
      `--http=${pocketBaseAddress(config.host, config.port)}`,
      `--dir=${paths.dataDir}`,
      `--migrationsDir=${migrationsDir}`,
      `--hooksDir=${hooksDir}`,
      "--automigrate=false",
    ],
    { cwd: paths.worktreeRoot, stdio: "inherit" },
  );
  try {
    await waitForHealth(child, `http://${pocketBaseAddress(config.host, config.port)}/api/health`);
  } catch (error) {
    await terminateChild(child);
    throw error;
  }
  return child;
}

export async function stopPocketBase(child: ChildProcess): Promise<void> {
  await terminateChild(child);
}

export async function resetPocketBaseData(
  paths = resolveRuntimePaths(),
  options: { force?: boolean; interactive?: boolean } = {},
): Promise<void> {
  await assertNoSymlinkInPath(paths.worktreeRoot, paths.dataDir);
  const interactive = options.interactive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY);
  if (!interactive && !options.force) {
    throw new Error("Non-interactive PocketBase reset requires the explicit --force flag.");
  }
  if (interactive && !options.force) {
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await prompt.question(`Type "reset" to delete ${paths.dataDir}: `);
    prompt.close();
    if (answer.trim() !== "reset") {
      throw new Error("PocketBase reset cancelled.");
    }
  }
  await rm(paths.dataDir, { recursive: true, force: true });
  console.log(`Removed PocketBase development data: ${paths.dataDir}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const parsed = parseArguments(args);
  if (parsed.command === "reset") {
    await resetPocketBaseData(undefined, { force: parsed.force });
    return;
  }

  const child = await startPocketBase(resolveConfig(process.env, args));
  await new Promise<void>((resolvePromise, rejectPromise) => {
    child.once("error", rejectPromise);
    child.once("exit", () => resolvePromise());
  });
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
