import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ensurePocketBaseBinary, POCKETBASE_VERSION, resolveRuntimePaths } from "./pocketbase.ts";

export type ArtifactOptions = {
  root?: string;
  output?: string;
  commit?: string;
};

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function createDeploymentArtifact(options: ArtifactOptions = {}): Promise<string> {
  const projectRoot = resolve(options.root ?? root);
  const output = resolve(options.output ?? join(projectRoot, ".local", "deployment", "release"));
  const outputRelative = relative(projectRoot, output);
  if (!outputRelative || outputRelative.startsWith("..") || isAbsolute(outputRelative)) {
    throw new Error(`Output path must be inside the project root (${projectRoot}); received ${output}.`);
  }
  const dist = join(projectRoot, "dist");
  const migrations = join(projectRoot, "pb_migrations");
  const hooks = join(projectRoot, "pb_hooks");

  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await cp(dist, join(output, "dist"), { recursive: true, errorOnExist: true });
  await cp(migrations, join(output, "pb_migrations"), { recursive: true, errorOnExist: true });
  await cp(hooks, join(output, "pb_hooks"), { recursive: true, errorOnExist: true });

  const binary = await ensurePocketBaseBinary(resolveRuntimePaths(projectRoot, "linux", "x64"));
  await cp(binary, join(output, "pocketbase"));
  const version = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8")) as {
    version: string;
  };
  await writeFile(
    join(output, "release.json"),
    `${JSON.stringify(
      {
        commit: options.commit ?? process.env.GITHUB_SHA ?? "local",
        packageVersion: version.version,
        pocketbaseVersion: "0.40.3",
      },
      null,
      2,
    )}\n`,
  );
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  createDeploymentArtifact({ output: process.argv[2] })
    .then((output) => console.log(`Created deployment artifact at ${output}`))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
