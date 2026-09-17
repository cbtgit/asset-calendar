import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pocketbase = spawn(process.execPath, [resolve(root, "scripts/pocketbase.ts"), "start"], {
  cwd: root,
  stdio: "inherit",
});
const frontend = spawn("vp", ["dev"], {
  cwd: root,
  stdio: "inherit",
});
const children: ChildProcess[] = [pocketbase, frontend];
const CHILD_SHUTDOWN_TIMEOUT_MS = 2_000;
let shuttingDown = false;
let shutdownPromise: Promise<void> | undefined;

function signalChild(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill(signal);
}

function waitForChildExit(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();

  return new Promise<void>((resolvePromise) => {
    let forceTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = (): void => {
      if (forceTimer) clearTimeout(forceTimer);
      child.off("exit", finish);
      child.off("error", finish);
      resolvePromise();
    };

    child.once("exit", finish);
    child.once("error", finish);
    forceTimer = setTimeout(() => {
      signalChild(child, "SIGKILL");
      finish();
    }, CHILD_SHUTDOWN_TIMEOUT_MS);
  });
}

async function stopChildren(): Promise<void> {
  const activeChildren = children.filter(
    (child) => child.exitCode === null && child.signalCode === null,
  );
  for (const child of activeChildren) {
    signalChild(child, "SIGTERM");
  }
  await Promise.all(activeChildren.map(waitForChildExit));
}

function requestShutdown(): void {
  if (shutdownPromise) return;
  shuttingDown = true;
  shutdownPromise = stopChildren();
}

process.once("SIGINT", requestShutdown);
process.once("SIGTERM", requestShutdown);
process.once("SIGHUP", requestShutdown);

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

await shutdownPromise;
