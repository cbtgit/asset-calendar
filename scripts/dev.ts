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
let shuttingDown = false;

function stopChildren(): void {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
}

function requestShutdown(): void {
  if (shuttingDown) return;
  shuttingDown = true;
  stopChildren();
}

process.once("SIGINT", requestShutdown);
process.once("SIGTERM", requestShutdown);

await new Promise<void>((resolvePromise, rejectPromise) => {
  type ChildResult = {
    code: number | null;
    signal: NodeJS.Signals | null;
    error?: Error;
    expectedTermination: boolean;
  };

  const results = new Map<ChildProcess, ChildResult>();
  const finish = (): void => {
    if (results.size !== children.length) return;
    const failure = [...results.values()].find(
      ({ code, signal, error, expectedTermination }) =>
        error || (code !== null && code !== 0) || (signal !== null && !expectedTermination),
    );
    if (failure) {
      rejectPromise(
        failure.error ??
          new Error(
            `Development process exited with code ${failure.code ?? "none"} and signal ${failure.signal ?? "none"}.`,
          ),
      );
    } else {
      resolvePromise();
    }
  };

  for (const child of children) {
    child.once("error", (error) => {
      results.set(child, {
        code: child.exitCode,
        signal: child.signalCode,
        error,
        expectedTermination: shuttingDown,
      });
      requestShutdown();
      finish();
    });
    child.once("exit", (code, signal) => {
      const previous = results.get(child);
      if (!previous?.error) {
        results.set(child, {
          code,
          signal,
          expectedTermination: shuttingDown,
        });
      }
      requestShutdown();
      finish();
    });
  }
});

stopChildren();
