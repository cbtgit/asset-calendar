import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pocketbase = spawn(process.execPath, [resolve(root, "scripts/pocketbase.ts"), "start"], {
  cwd: root,
  stdio: "inherit",
});
const frontend = spawn("vp", ["dev"], { cwd: root, stdio: "inherit" });
const children: ChildProcess[] = [pocketbase, frontend];

function stopChildren(): void {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
}

process.once("SIGINT", stopChildren);
process.once("SIGTERM", stopChildren);

await new Promise<void>((resolvePromise, rejectPromise) => {
  for (const child of children) {
    child.once("error", rejectPromise);
    child.once("exit", (code) => {
      if (code && code !== 0)
        rejectPromise(new Error(`Development process exited with code ${code}.`));
      else resolvePromise();
    });
  }
});

stopChildren();
