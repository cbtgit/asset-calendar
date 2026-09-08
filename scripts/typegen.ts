import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { ensurePocketBaseBinary, resolveRuntimePaths } from "./pocketbase.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = resolve(root, "tests/fixtures/pocketbase-typegen/migrations");

export async function generatePocketBaseTypes(outputPath: string): Promise<string> {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "asset-calendar-typegen-"));
  const dataDir = join(temporaryRoot, "data");
  await mkdir(dataDir);

  try {
    const binaryPath = await ensurePocketBaseBinary(resolveRuntimePaths(root));
    execFileSync(
      binaryPath,
      ["migrate", "up", `--dir=${dataDir}`, `--migrationsDir=${migrationsDir}`],
      { cwd: root, stdio: "ignore" },
    );
    await mkdir(dirname(outputPath), { recursive: true });
    execFileSync(
      process.execPath,
      [
        resolve(root, "node_modules/pocketbase-typegen/dist/cli.js"),
        "--db",
        join(dataDir, "data.db"),
        "--out",
        outputPath,
      ],
      { cwd: root, stdio: "ignore" },
    );
    return await readFile(outputPath, "utf8");
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

export async function assertPocketBaseTypegenIncompatible(): Promise<void> {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "asset-calendar-typegen-check-"));

  try {
    const firstPath = join(temporaryRoot, "first.ts");
    const secondPath = join(temporaryRoot, "second.ts");
    const first = await generatePocketBaseTypes(firstPath);
    const second = await generatePocketBaseTypes(secondPath);
    if (first !== second) {
      throw new Error(
        "pocketbase-typegen output is not deterministic for the same migration fixture.",
      );
    }

    const authCreateProbe = join(temporaryRoot, "auth-create.ts");
    await writeFile(
      authCreateProbe,
      `import type { Create } from ${JSON.stringify(firstPath)};\n` +
        `const authCreate: Create<"typegen_users"> = {\n` +
        `  displayName: "Example User",\n` +
        `  email: "example@example.com",\n` +
        `  password: "password",\n` +
        `  passwordConfirm: "password",\n` +
        `};\n` +
        `void authCreate;\n`,
    );
    const result = spawnSync(
      process.execPath,
      [
        resolve(root, "node_modules/typescript/bin/tsc"),
        "--ignoreConfig",
        "--noEmit",
        "--strict",
        "--skipLibCheck",
        "--target",
        "es2023",
        "--module",
        "nodenext",
        "--moduleResolution",
        "nodenext",
        "--lib",
        "ES2023,DOM",
        "--allowImportingTsExtensions",
        authCreateProbe,
      ],
      { cwd: root, encoding: "utf8" },
    );
    const compilerOutput = `${result.stdout}\n${result.stderr}`;
    if (result.status === 0 || !compilerOutput.includes("tokenKey")) {
      throw new Error(
        "The expected pocketbase-typegen auth-create incompatibility was not reproduced.",
      );
    }
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const command = process.argv[2] ?? "check";
  const operation =
    command === "check"
      ? assertPocketBaseTypegenIncompatible()
      : Promise.reject(new Error(`Unknown type generation command: ${command}`));
  operation.catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
