// @vitest-environment node
import { chmod, mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, it, vi } from "vite-plus/test";

let pocketbaseBinary = "";

vi.mock("./pocketbase.ts", () => ({
  POCKETBASE_VERSION: "0.40.3",
  ensurePocketBaseBinary: async () => pocketbaseBinary,
  resolveRuntimePaths: () => ({} as any),
}));

it("creates a release containing only production inputs", async () => {
  const root = await mkdtemp(join(tmpdir(), "asset-calendar-artifact-"));
  await mkdir(join(root, "dist"));
  await mkdir(join(root, "pb_migrations"));
  await mkdir(join(root, "pb_hooks"));
  await writeFile(join(root, "dist", "index.html"), "app");
  await writeFile(join(root, "package.json"), '{"version":"0.0.0"}');

  pocketbaseBinary = join(root, "pocketbase-test-binary");
  await writeFile(pocketbaseBinary, "binary");
  await chmod(pocketbaseBinary, 0o755);

  const output = join(root, "release");

  const { createDeploymentArtifact } = await import("./deploy-artifact.ts");
  await createDeploymentArtifact({ root, output, commit: "test-sha" });

  expect(await readFile(join(output, "dist", "index.html"), "utf8")).toBe("app");
  expect(await readFile(join(output, "release.json"), "utf8")).toContain("test-sha");
  expect((await stat(join(output, "pocketbase"))).size).toBeGreaterThan(0);
});
